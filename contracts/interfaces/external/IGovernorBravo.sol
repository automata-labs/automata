// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGovernorBravo {
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
        uint abstainVotes,
        bool canceled,
        bool executed
    );

    /// @notice Gets the state of a proposal
    /// @param proposalId The id of the proposal
    /// @return Proposal state
    function state(uint proposalId) external view returns (uint);

    /// @notice Cast a vote for a proposal
    /// @param proposalId The id of the proposal to vote on
    /// @param support The support value for the vote. 0=against, 1=for, 2=abstain
    function castVote(uint proposalId, uint8 support) external;
}
