// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerState {
    /// @notice Returns a shard from a cursor.
    function shards(uint256 cursor) external view returns (address);

    /// @notice Returns a cursor from a shard.
    function cursors(address shard) external view returns (uint256);

    /// @notice Returns the total amount of tokens sequenced into the sequencer's shards.
    function liquidity() external view returns (uint256);
}
