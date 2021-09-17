// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IOperator.sol";

import "@openzeppelin/contracts/governance/IGovernor.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import "./interfaces/IKernel.sol";
import "./interfaces/IObserver.sol";
import "./interfaces/IOperatorFactory.sol";
import "./interfaces/ISequencer.sol";
import "./libraries/access/Access.sol";
import "./libraries/data/Slot.sol";
import "./libraries/math/Cast.sol";
import "./libraries/helpers/Shell.sol";
import "./libraries/utils/Lock.sol";
import "./libraries/utils/Multicall.sol";
import "./libraries/utils/RevertMsgExtractor.sol";

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

    /// @inheritdoc IOperatorState
    address public override observer;
    /// @inheritdoc IOperatorState
    bool public override collapsed;
    /// @inheritdoc IOperatorState
    uint256 public override pid;

    constructor() {
        (kernel, underlying) = IOperatorFactory(msg.sender).parameters();
    }

    /// @inheritdoc IOperatorFunctions
    function set(bytes4 selector, bytes memory data) external override auth {
        if (selector == IOperatorState.sequencer.selector) sequencer = abi.decode(data, (ISequencer));
        else if (selector == IOperatorState.governor.selector) governor = abi.decode(data, (address));
        else if (selector == IOperatorState.observer.selector) observer = abi.decode(data, (address));
        else revert("!");
    }

    /// @inheritdoc IOperatorFunctions
    function virtualize(address tox, address toy) external override lock {
        _observe();
        require(!collapsed, "CLPSE");

        uint256 amount = sequencer.deposit();
        // FIXME: Use multicall to save gas
        kernel.modify(underlying, tox, amount.u128().i128(), 0);
        kernel.modify(underlying, toy, 0, amount.u128().i128());

        emit Virtualized(msg.sender, tox, toy, amount.u128());
    }

    /// @inheritdoc IOperatorFunctions
    function realize(address to) external override lock {
        Slot.Data memory slot = kernel.get(underlying, address(this));
        uint128 amount = Math.min(slot.x, slot.y).u128();
        kernel.modify(underlying, address(this), -amount.i128(), -amount.i128());
        sequencer.withdraw(to, amount);

        emit Realized(msg.sender, to, amount);
    }

    /// @inheritdoc IOperatorFunctions
    function transfer(address to, uint128 x, uint128 y) external override lock {
        kernel.move(underlying, msg.sender, to, x, y);
    }

    /// @inheritdoc IOperatorFunctions
    function pay(address token, address to, uint256 value) external override {
        TransferHelper.safeTransferFrom(token, msg.sender, to, value);
    }

    function _observe() internal {
        if (observer != address(0)) {
            bytes memory data = abi.encodeWithSelector(IObserverFunctions.observe.selector);
            (bool success, bytes memory result) = observer.delegatecall(data);
            if (!success) revert(RevertMsgExtractor.getRevertMsg(result));
        } else {
            collapsed = false;
            pid = 0;
        }
    }
}
