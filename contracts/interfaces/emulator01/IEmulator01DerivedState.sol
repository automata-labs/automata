// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IEmulator01DerivedState {
    /// @notice Returns the start- and end blocks for the summing period.
    function phase0(uint256 pid) external view returns (uint256, uint256);

    /// @notice Returns the start- and end blocks for the voting period.
    function phase1(uint256 pid) external view returns (uint256, uint256)
}
