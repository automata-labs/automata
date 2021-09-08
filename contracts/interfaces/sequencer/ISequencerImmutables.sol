// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerImmutables {
    /// @notice Returns the underlying token.
    function underlying() external view returns (address);

    /// @notice Returns the decimals of the underlying token.
    function decimals() external view returns (uint256);

    /// @notice Returns the shard contract implementation.
    function implementation() external view returns (address);
}
