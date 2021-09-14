// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IROMStateDerived {
    /// @notice Returns the start- and end blocks for the summing period.
    function summingPeriod(uint256 pid) external view returns (uint256 startBlock, uint256 endBlock);

    /// @notice Returns the start- and end blocks for the voting period.
    function votingPeriod(uint256 pid) external view returns (uint256 startBlock, uint256 endBlock);
}
