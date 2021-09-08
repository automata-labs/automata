// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerStateDerived {
    /// @notice Returns the current number of shards.
    function cardinality() external view returns (uint256);

    /// @notice Returns the max number of shards that can be cloned.
    function cardinalityMax() external view returns (uint256);

    /// @notice Returns a deterministically computed the shard addresses.
    function compute(uint256 cursor) external view returns (address);
}
