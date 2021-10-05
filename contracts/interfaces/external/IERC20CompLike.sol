// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@yield-protocol/utils-v2/contracts/token/IERC20.sol";

interface IERC20CompLike is IERC20 {
    /// @notice A record of each accounts delegate
    function delegates(address) external view returns (address);

    /// @notice Delegate votes from `msg.sender` to `delegatee`
    /// @param delegatee The address to delegate votes to
    function delegate(address delegatee) external;

    /// @notice Gets the current votes balance for `account`
    /// @param account The address to get votes balance
    /// @return The number of current votes for `account`
    function getCurrentVotes(address account) external view returns (uint96);

    /// @notice Determine the prior number of votes for an account as of a block number
    /// @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
    /// @param account The address of the account to check
    /// @param blockNumber The block number to get the vote balance at
    /// @return The number of votes the account had as of the given block
    function getPriorVotes(address account, uint blockNumber) external view returns (uint96);
}
