// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGovernorAlpha {
    /// @notice The total number of proposals
    function proposalCount() external view returns (uint);

    /// @notice The official record of all proposals ever proposed
    function proposals(uint proposalId) external view returns (
        uint id,
        address proposer,
        uint eta,
        uint startBlock,
        uint endBlock,
        uint forVotes,
        uint againstVotes,
        bool canceled,
        bool executed
    );

    /// @notice Gets the state of a proposal
    /// @param proposalId The id of the proposal
    /// @return Proposal state
    function state(uint proposalId) external view returns (uint);

    /// @notice Cast a vote for a proposal
    /// @param proposalId The id of the proposal to vote on
    /// @param support The support value for the vote. `true` is for and `false` is against
    function castVote(uint proposalId, bool support) external;
}
