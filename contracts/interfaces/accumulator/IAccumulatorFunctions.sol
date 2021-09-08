// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IAccumulatorFunctions {
    /// @notice Grows the accumulator's `x128` value.
    /// @dev The function can be called by any account, but is expected to be called by the emulator contract.
    function grow(address underlying) external returns (uint128 amount);

    /// @notice Stake `x` to earn `y` when vTokens are consumed.
    function stake(address underlying, address to) external returns (uint128 x);

    /// @notice Unstake `x` from the accumulator.
    /// @dev Unstaking does not affect the amount collectable by a user. The order is not of significance.
    function unstake(address underlying, address to, uint128 x) external;

    /// @notice Collects `y` amount from the accumulator.
    function collect(address underlying, address to, uint128 y) external returns (uint128 amount);
}
