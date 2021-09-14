// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IObserver.sol";

import "./interfaces/IKernel.sol";
import "./interfaces/operator/IOperatorImmutables.sol";
import "./interfaces/operator/IOperatorState.sol";
import "./interfaces/external/IGovernorAlpha.sol";

/// @title Observer
contract Observer is IObserver, IOperatorImmutables, IOperatorState {
    /// @inheritdoc IOperatorImmutables
    function kernel() external pure override returns (IKernel) { revert("PROXY"); }
    /// @inheritdoc IOperatorImmutables
    function underlying() external pure override returns (address) { revert("PROXY"); }

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

    /// @inheritdoc IObserver
    function observe() external override {
        uint256 count = IGovernorAlpha(governor).proposalCount();
        uint256 state = IGovernorAlpha(governor).state(count);

        if (!collapsed && state <= 1) {
            pid = count;
            collapsed = false;
        } else if (collapsed && state > 1) {
            pid = 0;
            collapsed = false;
        }
    }
}
