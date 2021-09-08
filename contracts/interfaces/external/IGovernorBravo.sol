// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGovernorBravo {
    function proposalCount() external view returns (uint);
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
    function state(uint proposalId) external view returns (uint);
}
