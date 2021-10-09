// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerEvents {
    /// @notice Emitted when a shard is cloned.
    /// @param cursor The cursor of the cloned shard.
    /// @param shard The address of the cloned shard.
    event Cloned(uint256 cursor, address shard);

    /// @notice Emitted when `sequence` is called.
    /// @param liquidity The amount of liquidity deposited into the sequencer.
    event Deposited(uint256 liquidity);

    /// @notice Emitted when `withdraw` is called.
    /// @param liquidity The amount of liquidity withdrawn into the sequencer.
    event Withdrawn(uint256 liquidity);
}
