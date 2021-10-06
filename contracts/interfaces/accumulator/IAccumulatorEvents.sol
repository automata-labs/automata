// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IAccumulatorEvents {
    /// @notice Emitted when `grow` is called.
    event Grown(address indexed sender, address indexed coin, uint128 y);

    /// @notice Emitted when `stake` is called.
    event Staked(address indexed sender, address indexed coin, address indexed to, uint128 dx);

    /// @notice Emitted when `unstake` is called.
    event Unstaked(address indexed sender, address indexed coin, address indexed to, uint128 dx);

    /// @notice Emitted when `collect` is called.
    event Collected(address indexed sender, address indexed coin, address indexed to, uint128 y);
}
