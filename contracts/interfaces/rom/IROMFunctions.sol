// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IROMFunctions {
    /// @notice Initialize the ROM - called by the emulator.
    function initialize() external;

    /// @notice Sum votes before the votes are cast by the protocol.
    function sum(uint256 pid, bool support) external;

    /// @notice Trigger the protocol to cast votes with a specified cursor.
    function vote(uint256 pid, uint256 cursor) external;
}
