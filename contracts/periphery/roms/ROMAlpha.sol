// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../interfaces/IROM.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../interfaces/IAccumulator.sol";
import "../../interfaces/IComputer.sol";
import "../../interfaces/ISequencer.sol";
import "../../interfaces/external/IERC20CompLike.sol";
import "../../interfaces/external/IGovernorAlpha.sol";
import "../../libraries/access/Access.sol";
import "../../libraries/data/Checkpoint.sol";
import "../../libraries/proxy/ERC1967Implementation.sol";
import "../../libraries/utils/RevertMsgExtractor.sol";

/// @title ROMAlpha
contract ROMAlpha is IROM, ERC1967Implementation, Access {
    /// @inheritdoc IEmulatorImmutables
    function underlying() external pure override returns (address) { revert("IMMUTABLE"); }
    /// @inheritdoc IEmulatorImmutables
    function decimals() external pure override returns (uint8) { revert("IMMUTABLE"); }

    /// @inheritdoc IROMState
    address public override accumulator;
    /// @inheritdoc IROMState
    address public override sequencer;
    /// @inheritdoc IROMState
    address public override governor;
    /// @inheritdoc IROMState
    uint32 public override period;

    /// @inheritdoc IROMState
    mapping(uint256 => Checkpoint.Data) public override checkpoints;
    /// @inheritdoc IROMState
    mapping(uint256 => Slot.Data) public override votes;
    /// @inheritdoc IROMState
    address public override computer;

    /// @inheritdoc IROMFunctions
    function set(bytes4 selector, bytes memory data) external override auth {
        if (selector == IROMState.accumulator.selector) accumulator = abi.decode(data, (address));
        else if (selector == IROMState.sequencer.selector) sequencer = abi.decode(data, (address));
        else if (selector == IROMState.governor.selector) governor = abi.decode(data, (address));
        else if (selector == IROMState.period.selector) period = abi.decode(data, (uint32));
        else if (selector == IROMState.computer.selector) computer = abi.decode(data, (address));
        else revert("!");
    }

    /// @inheritdoc IROMStateDerived
    function timeline(uint256 pid) external view override returns (uint256, uint256, uint256, uint256) {
        return _timeline(pid);
    } 

    /// @inheritdoc IROMFunctions
    function choice(uint256 pid, uint8 support) external override {
        uint128 amount = IAccumulator(accumulator).grow(this.underlying());
        require(amount > 0, "0");

        (uint256 start, uint256 end,,) = _timeline(pid);
        require(start > 0, "T0");
        require(block.number >= start, "BEG");
        require(block.number <= end, "END");

        if (support == uint8(1)) {
            votes[pid].x += amount;
        } else if (support == uint8(0)) {
            votes[pid].y += amount;
        } else {
            revert("8");
        }
    }

    /// @inheritdoc IROMFunctions
    function trigger(uint256 pid, uint256 cursor) external override {
        (,, uint256 start, uint256 end) = _timeline(pid);
        require(start > 0, "T0");
        require(block.number >= start, "BEG");
        require(block.number <= end, "END");

        Checkpoint.Data memory checkpoint = _checkpoint(pid, start);
        (bool support, uint256 amount) = _compute(checkpoint.votes, votes[pid].x, votes[pid].y);

        // bit field verification
        uint256 mask = 1 << cursor;
        if (amount > (1 << checkpoint.cursor) - 1) {
            if (checkpoint.cursor != cursor) {
                uint256 head = checkpoint.votes - ((1 << checkpoint.cursor) - 1);
                require((amount - head) & mask == mask, "F0");
            }
        } else {
            require((amount & mask) == mask, "F1");
        }

        // cast vote
        address[] memory targets  = new address[](1);
        bytes[] memory data = new bytes[](1);
        targets[0] = governor;
        data[0] = abi.encodeWithSelector(IGovernorAlpha.castVote.selector, pid, support);

        ISequencer(sequencer).execute(cursor, targets, data);
    }

    function _timeline(uint256 pid) internal view returns (uint256, uint256, uint256, uint256) {
        (uint256 start, uint256 end) = _endpoints(pid);
        return (start, start + period - 1, start + period, end);
    }

    function _endpoints(uint256 pid) internal view returns (uint256 start, uint256 end) {
        (,,, start, end,,,,) = IGovernorAlpha(governor).proposals(pid);
    }

    function _checkpoint(uint256 pid, uint256 blockNumber) internal returns (Checkpoint.Data memory) {
        if (checkpoints[pid].votes == 0) {
            uint256 checkpointedCursor;
            uint256 checkpointedVotes;
            ISequencer _sequencer = ISequencer(sequencer);

            for (uint256 i = 0; i < _sequencer.cardinality(); i++) {
                uint256 priorVotes =
                    IERC20CompLike(this.underlying()).getPriorVotes(_sequencer.shards(i), blockNumber);
                uint256 capacity = (uint256(10) ** uint256(this.decimals()) << i);

                checkpointedVotes += priorVotes / (uint256(10) ** uint256(this.decimals()));
                if (priorVotes < capacity || i == _sequencer.cardinality() - 1) {
                    checkpointedCursor = i;
                    break;
                }
            }

            checkpoints[pid].cursor = checkpointedCursor;
            checkpoints[pid].votes = checkpointedVotes;
        }

        return checkpoints[pid];
    }

    function _compute(uint256 max, uint256 x, uint256 y) internal view returns (bool, uint256) {
        bytes memory data = _staticcall(computer, abi.encodeWithSignature("compute(uint128,uint128)", x, y));
        (uint8 option, uint256 amount) = abi.decode(data, (uint8, uint256));

        bool support = option == uint8(1) ? true : false;
        uint256 normalized = Math.min(max, amount / (uint256(10) ** uint256(this.decimals())));

        return (support, normalized);
    }

    function _staticcall(address target, bytes memory data) internal view returns (bytes memory) {
        require(target != address(0), "ADDR0");
        (bool success, bytes memory result) = target.staticcall(data);
        if (!success) revert(RevertMsgExtractor.getRevertMsg(result));

        return result;
    }

    function _authorizeUpgrade(address) internal override auth {}
}
