// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IOperator.sol";

import "@openzeppelin/contracts/governance/IGovernor.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import "./interfaces/IKernel.sol";
import "./interfaces/IOperatorFactory.sol";
import "./interfaces/ISequencer.sol";
import "./libraries/access/Access.sol";
import "./libraries/data/Slot.sol";
import "./libraries/math/Cast.sol";
import "./libraries/utils/Lock.sol";
import "./libraries/utils/Multicall.sol";
import "./libraries/utils/Shell.sol";

/// @title Operator
contract Operator is IOperator, Access, Lock, Multicall {
    using Cast for uint256;
    using Cast for uint128;
    using Shell for IKernel;

    /// @inheritdoc IOperatorImmutables
    IKernel public immutable override kernel;
    /// @inheritdoc IOperatorImmutables
    address public immutable override underlying;

    /// @inheritdoc IOperatorState
    ISequencer public override sequencer;
    /// @inheritdoc IOperatorState
    address public override governor;

    struct Frozen {
        uint256 id;
        bool frozen;
    }
    /// @inheritdoc IOperatorState
    Frozen public override frozen;

    constructor() {
        (kernel, underlying) = IOperatorFactory(msg.sender).parameters();
    }

    function set(bytes32 key, bytes memory data) external auth {
        if (key == "sequencer") sequencer = abi.decode(data, (ISequencer));
        else if (key == "governor") governor = abi.decode(data, (address));
        else revert("!");
    }

    /// @inheritdoc IOperatorFunctions
    function freeze(uint256 pid) external override {
        // governor is considered active on either `Pending` or `Active` states
        // `virtualize` should be frozen when governor is active
        IGovernor.ProposalState pstate = IGovernor(governor).state(pid);
        if (pstate == IGovernor.ProposalState.Pending || pstate == IGovernor.ProposalState.Active) {
            frozen.frozen = true;
            frozen.id = pid;
        }
    }

    /// @inheritdoc IOperatorFunctions
    function unfreeze() external override {
        IGovernor.ProposalState pstate = IGovernor(governor).state(frozen.id);
        if (pstate != IGovernor.ProposalState.Pending && pstate != IGovernor.ProposalState.Active) {
            frozen.frozen = false;
            frozen.id = 0;
        }
    }

    /// @inheritdoc IOperatorFunctions
    function virtualize(address tox, address toy) external override lock {
        require(frozen.frozen == false, "FROZEN");

        uint256 amount = sequencer.deposit();
        // FIXME: Use multicall to save gas
        kernel.modify(underlying, tox, amount.u128().i128(), 0);
        kernel.modify(underlying, toy, 0, amount.u128().i128());

        emit Joined(msg.sender, tox, toy, amount.u128());
    }

    /// @inheritdoc IOperatorFunctions
    function realize(address to) external override lock {
        Slot.Data memory slot = kernel.get(underlying, address(this));
        uint128 amount = Math.min(slot.x, slot.y).u128();
        kernel.modify(underlying, address(this), -amount.i128(), -amount.i128());
        sequencer.withdraw(to, amount);

        emit Exited(msg.sender, to, amount);
    }

    /// @inheritdoc IOperatorFunctions
    function transfer(address to, uint128 x, uint128 y) external override lock {
        kernel.move(underlying, msg.sender, to, x, y);
    }

    /// @inheritdoc IOperatorFunctions
    function pay(address token, address to, uint256 value) external override {
        TransferHelper.safeTransferFrom(token, msg.sender, to, value);
    }
}
