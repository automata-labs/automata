// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IROMFunctions {
    /// @notice Set variables.
    function set(bytes4 selector, bytes memory data) external;

    /// @notice Sum votes before the votes are cast by the protocol.
    function choice(uint256 pid, uint8 support) external;

    /// @notice Trigger the protocol to cast votes with a specified cursor.
    function trigger(uint256 pid, uint256 cursor) external;
}
