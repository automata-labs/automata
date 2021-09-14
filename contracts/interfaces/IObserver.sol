// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IObserver {
    /// @notice Observe whether the governor is active or not.
    /// @dev When governor is active, collapse - otherwise uncollapse.
    function observe() external;
}
