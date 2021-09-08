// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IKernel.sol";
import "../libraries/data/State.sol";

interface IAccumulator {
    /// @notice Returns the kernel contract;
    function kernel() external view returns (IKernel);

    /// @notice The mapping from an underlying to last observed contract owned state.
    /// @dev The accumulators aggregates all of the values of the user owned states.
    function accumulators(address underlying) external view returns (uint128 x, uint128 y, uint256 x128);

    /// @notice The mapping from a key to a user owned state.
    function states(bytes32 key) external view returns (uint128 x, uint128 y, uint256 x128);

    /// @notice Returns a protocol owned state.
    function getAccumulator(address underlying) external view returns (State.Data memory);

    /// @notice Returns a user owned state.
    function getState(address underlying, address owner) external view returns (State.Data memory);

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
