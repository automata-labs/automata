// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IAccumulatorState {
    /// @notice The mapping from an coin to last observed contract owned state.
    /// @dev The globs aggregates all of the values of the user owned states.
    function globs(address coin) external view returns (uint128 x, uint128 y, uint256 x128);

    /// @notice The mapping from a key to a user owned unit states.
    function units(bytes32 key) external view returns (uint128 x, uint128 y, uint256 x128);
}
