// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../interfaces/IObserver.sol";

import "../../interfaces/IKernel.sol";
import "../../interfaces/external/IGovernorBravo.sol";
import "../../libraries/access/Access.sol";
import "../../libraries/utils/Lock.sol";

/// @title ObserverBravo
contract ObserverBravo is IObserver, Access, Lock {
    /// @inheritdoc IOperatorImmutables
    function kernel() external pure override returns (IKernel) { revert("IMMUTABLE"); }
    /// @inheritdoc IOperatorImmutables
    function underlying() external pure override returns (address) { revert("IMMUTABLE"); }

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

    /// @inheritdoc IObserverFunctions
    function observe() external override {
        uint256 count = IGovernorBravo(governor).proposalCount();
        if (count <= 1) return;

        uint256 state = IGovernorBravo(governor).state(count);
        if (!collapsed && state <= 1) {
            collapsed = true;
            pid = count;
        } else if (collapsed && state > 1) {
            collapsed = false;
            pid = 0;
        }
    }
}
