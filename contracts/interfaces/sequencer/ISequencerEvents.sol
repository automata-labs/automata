// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerEvents {
    /// @notice Emitted when a shard is cloned.
    event Cloned(address indexed sender, uint256 cursor, address shard);

    /// @notice Emitted when `sequence` is called.
    event Sequenced(address indexed sender, uint256 liquidity);

    /// @notice Emitted when `withdraw` is called.
    event Withdrawn(address indexed sender, uint256 liquidity);
}
