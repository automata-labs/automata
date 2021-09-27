// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGovernorBravo {
    /// @notice The total number of proposals
    function proposalCount() external view returns (uint256);

    /// @notice The official record of all proposals ever proposed
    function proposals(uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        uint256 eta,
        uint256 startBlock,
        uint256 endBlock,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        bool canceled,
        bool executed
    );

    /// @notice Function used to propose a new proposal. Sender must have delegates above the proposal threshold
    /// @param targets Target addresses for proposal calls
    /// @param values Eth values for proposal calls
    /// @param signatures Function signatures for proposal calls
    /// @param calldatas Calldatas for proposal calls
    /// @param description String description of the proposal
    /// @return Proposal id of new proposal
    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) external returns (uint256);

    /// @notice Gets the state of a proposal
    /// @param proposalId The id of the proposal
    /// @return Proposal state
    function state(uint256 proposalId) external view returns (uint256);

    /// @notice Cast a vote for a proposal
    /// @param proposalId The id of the proposal to vote on
    /// @param support The support value for the vote. 0=against, 1=for, 2=abstain
    function castVote(uint256 proposalId, uint8 support) external;
}
