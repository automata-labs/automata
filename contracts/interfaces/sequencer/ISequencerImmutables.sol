// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerImmutables {
    /// @notice Returns the coin token.
    function coin() external view returns (address);

    /// @notice Returns the shard contract implementation.
    function implementation() external view returns (address);
}
