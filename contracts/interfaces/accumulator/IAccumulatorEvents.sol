// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IAccumulatorEvents {
    /// @notice Emitted when `stake` is called.
    /// @param id The ERC721 id.
    /// @param dx The amount staked.
    event Staked(uint256 indexed id, uint128 dx);

    /// @notice Emitted when `unstake` is called.
    /// @param id The ERC721 id.
    /// @param to The account that receives the unstaked amount.
    /// @param dx The amount unstaked.
    event Unstaked(uint256 indexed id, address to, uint128 dx);

    /// @notice Emitted when `collect` is called.
    /// @param id The ERC721 id.
    /// @param to The account that receives the collected amount.
    /// @param dy The amount collected.
    event Collected(uint256 indexed id, address to, uint128 dy);

    /// @notice Emitted when the `coin` value is set or updated.
    /// @param id The ERC721 id.
    /// @param coin The token address.
    event Picked(uint256 indexed id, address coin);

    /// @notice Emitted when `grow` is called.
    /// @param coin The token address.
    /// @param dy The amount the accumulator is grown by.
    event Grown(address indexed coin, uint128 dy);
}
