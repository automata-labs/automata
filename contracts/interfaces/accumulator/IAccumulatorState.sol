// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IAccumulatorState {
    /// @notice The mapping from a coin to last observed contract owned state.
    /// @dev The globs aggregates all of the values of the user owned states.
    function globs(address coin) external view returns (uint128 x, uint128 y, uint256 x128);

    /// @notice The mapping from an ERC721 id to a user owned stake.
    function units(uint256 id) external view returns (
        uint96 nonce,
        address coin,
        uint128 x,
        uint128 y,
        uint256 x128
    );
}
