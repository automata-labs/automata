// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IAccumulatorEvents {
    /// @notice Emitted when `stake` is called.
    event Staked(uint256 indexed id, uint128 dx);

    /// @notice Emitted when `unstake` is called.
    event Unstaked(uint256 indexed id, uint128 dx);

    /// @notice Emitted when `collect` is called.
    event Collected(uint256 indexed id, address to, uint128 dy);

    /// @notice Emitted when the `coin` value is set or updated.
    event Picked(uint256 indexed id, address coin);

    /// @notice Emitted when `grow` is called.
    event Grown(address indexed coin, uint128 dy);
}
