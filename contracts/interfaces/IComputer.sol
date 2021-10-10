// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IComputer {
    /// @notice Maps the internal votes to realized votes that will be cast/routed to the governor.
    /// @param m The max amount of votes available in the protocol.
    /// @param x The amount of internal for votes.
    /// @param y The amount of internal against votes.
    function compute(uint128 m, uint128 x, uint128 y) external pure returns (uint8, uint256);
}
