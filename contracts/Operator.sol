// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IOperator.sol";
import "./interfaces/IOperatorEvents.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import "./interfaces/IKernel.sol";
import "./interfaces/IOperatorFactory.sol";
import "./interfaces/ISequencer.sol";
import "./libraries/access/Access.sol";
import "./libraries/math/Cast.sol";
import "./libraries/utils/Lock.sol";
import "./libraries/utils/Multicall.sol";
import "./libraries/utils/Shell.sol";

/// @title Operator
contract Operator is IOperator, IOperatorEvents, Access, Lock, Multicall {
    using Cast for uint256;
    using Cast for uint128;
    using Shell for IKernel;

    /// @inheritdoc IOperator
    IKernel public immutable override kernel;
    /// @inheritdoc IOperator
    address public immutable override underlying;
    /// @inheritdoc IOperator
    ISequencer public override sequencer;

    constructor() {
        (kernel, underlying) = IOperatorFactory(msg.sender).parameters();
    }

    /// @inheritdoc IOperator
    function set(ISequencer sequencer_) external override auth {
        sequencer = sequencer_;
        emit Set(msg.sender, address(sequencer));
    }

    /// @inheritdoc IOperator
    function join(address tox, address toy) external override lock {
        uint256 amount = sequencer.deposit();
        // FIXME: Use multicall to save gas
        kernel.modify(underlying, tox, amount.u128().i128(), 0);
        kernel.modify(underlying, toy, 0, amount.u128().i128());

        emit Joined(msg.sender, tox, toy, amount.u128());
    }

    /// @inheritdoc IOperator
    function exit(address to) external override lock {
        State.Data memory state = kernel.fetch(underlying, address(this));
        uint128 amount = Math.min(state.x, state.y).u128();
        kernel.modify(underlying, address(this), -amount.i128(), -amount.i128());
        sequencer.withdraw(to, amount);

        emit Exited(msg.sender, to, amount);
    }

    /// @inheritdoc IOperator
    function move(address from, address to, uint128 x, uint128 y) external override lock {
        kernel.move(underlying, from, to, x, y);
    }

    /// @inheritdoc IOperator
    function pay(address token, address to, uint256 value) external override {
        TransferHelper.safeTransferFrom(token, msg.sender, to, value);
    }
}
