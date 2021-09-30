// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/IOperator.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@yield-protocol/utils-v2/contracts/token/IERC20Metadata.sol";

import "../interfaces/IAccumulator.sol";
import "../interfaces/IComputer.sol";
import "../interfaces/IKernel.sol";
import "../interfaces/ISequencer.sol";
import "../interfaces/external/IERC20CompLike.sol";
import "../libraries/data/Checkpoint.sol";
import "../libraries/data/Slot.sol";
import "../libraries/helpers/Shell.sol";
import "../libraries/math/Cast.sol";
import "../libraries/math/Cursor.sol";
import "../libraries/utils/RevertMsgExtractor.sol";

abstract contract Operator is IOperator {
    using Cast for uint256;
    using Cast for uint128;
    using Shell for IKernel;

    /// @inheritdoc IOperatorImmutables
    address public immutable kernel;
    /// @inheritdoc IOperatorState
    address public accumulator;
    /// @inheritdoc IOperatorState
    address public sequencer;

    /// @inheritdoc IOperatorImmutables
    address public immutable underlying;
    /// @inheritdoc IOperatorImmutables
    uint256 public immutable decimals;

    /// @inheritdoc IOperatorState
    address public governor;
    /// @inheritdoc IOperatorState
    uint256 public period;
    /// @inheritdoc IOperatorState
    address public computer;

    /// @inheritdoc IOperatorState
    bool public observe;
    /// @inheritdoc IOperatorState
    uint256 public limit;

    /// @inheritdoc IOperatorState
    mapping(uint256 => Checkpoint.Data) public checkpoints;
    /// @inheritdoc IOperatorState
    mapping(uint256 => Slot.Data) public votes;

    constructor(address kernel_, address underlying_) {
        kernel = kernel_;
        underlying = underlying_;
        decimals = IERC20Metadata(underlying_).decimals();
        observe = true;
    }

    /// @inheritdoc IOperatorStateDerived
    function timeline(uint256 pid) external view returns (uint256, uint256, uint256, uint256) {
        return _timeline(pid);
    }

    /// @inheritdoc IOperatorFunctions
    function set(bytes4 selector, bytes memory data) external {
        if (selector == IOperatorState.accumulator.selector) accumulator = abi.decode(data, (address));
        else if (selector == IOperatorState.sequencer.selector) sequencer = abi.decode(data, (address));
        else if (selector == IOperatorState.governor.selector) governor = abi.decode(data, (address));
        else if (selector == IOperatorState.period.selector) period = abi.decode(data, (uint32));
        else if (selector == IOperatorState.computer.selector) computer = abi.decode(data, (address));
        else if (selector == IOperatorState.observe.selector) observe = abi.decode(data, (bool));
        else if (selector == IOperatorState.limit.selector) limit = abi.decode(data, (uint256));
        else revert("!");
    }

    /// @inheritdoc IOperatorFunctions
    function join(address tox, address toy) external {
        if (observe) _observe();
        uint256 amount = ISequencer(sequencer).deposit();
        require(amount > 0, "0");
        require(IKernel(kernel).pool(underlying, amount.u128().i128()) <= limit, "LIM");
        IKernel(kernel).modify(underlying, tox, amount.u128().i128(), 0);
        IKernel(kernel).modify(underlying, toy, 0, amount.u128().i128());

        emit Joined(msg.sender, tox, toy, amount.u128());
    }

    /// @inheritdoc IOperatorFunctions
    function exit(address to) external {
        Slot.Data memory slot = IKernel(kernel).get(underlying, address(this));
        uint128 amount = Math.min(slot.x, slot.y).u128();
        require(amount > 0, "0");
        IKernel(kernel).modify(underlying, address(this), -amount.i128(), -amount.i128());
        ISequencer(sequencer).withdraw(to, amount);

        emit Exited(msg.sender, to, amount.u128());
    }

    /// @inheritdoc IOperatorFunctions
    function transfer(address to, uint128 x, uint128 y) external {
        IKernel(kernel).transfer(underlying, msg.sender, to, x, y);

        emit Transferred(msg.sender, to, x, y);
    }

    /// @inheritdoc IOperatorFunctions
    function use(uint256 pid, uint8 support) external virtual;

    /// @inheritdoc IOperatorFunctions
    function route(uint256 pid, uint256 cursor) external virtual;

    function _observe() internal view virtual;

    function _timeline(uint256 pid) internal view virtual returns (uint256, uint256, uint256, uint256);

    function _checkpoint(uint256 pid, uint256 blockNumber) internal returns (Checkpoint.Data memory) {
        if (checkpoints[pid].votes == 0) {
            uint256 checkpointedVotes;
            ISequencer _sequencer = ISequencer(sequencer);

            for (uint256 i = 0; i < _sequencer.cardinality(); i++) {
                uint256 priorVotes =
                    IERC20CompLike(underlying).getPriorVotes(_sequencer.shards(i), blockNumber);
                uint256 capacity = (uint256(10) ** decimals << i);

                if (priorVotes < capacity || i == _sequencer.cardinality() - 1) {
                    checkpointedVotes += priorVotes;
                    break;
                } else {
                    checkpointedVotes += priorVotes;
                }
            }

            checkpoints[pid].votes = checkpointedVotes;
            checkpoints[pid].cursor = Cursor.getCursorRoundingUp(checkpointedVotes, decimals);
        }

        return checkpoints[pid];
    }

    function _compute(uint256 m, uint256 x, uint256 y) internal view returns (uint8, uint256) {
        bytes memory data = _staticcall(computer, abi.encodeWithSelector(IComputer.compute.selector, m, x, y));
        (uint8 support, uint256 amount) = abi.decode(data, (uint8, uint256));

        return (support, amount);
    }

    function _staticcall(address target, bytes memory data) internal view returns (bytes memory) {
        require(target != address(0), "ADDR0");
        (bool success, bytes memory result) = target.staticcall(data);
        if (!success) revert(RevertMsgExtractor.getRevertMsg(result));

        return result;
    }
}
