// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IAccumulatorFunctions {
    /// @notice Mint an ERC721 token which represents the owner's stake.
    function mint(address coin, address to) external returns (uint256 id, uint128 dx);

    /// @notice Burn an ERC721.
    /// @dev Only callable if internal values are zero.
    function burn(uint256 id) external;

    /// @notice Stake internal `x`.
    function stake(uint256 id) external returns (uint128 dx);

    /// @notice Unstake internal `x`.
    function unstake(uint256 id, address to, uint128 dx) external;

    /// @notice Collect `y` from the accumulator.
    function collect(uint256 id, address to, uint128 dy) external returns (uint128 c);

    /// @notice Renew an ERC721 token's `coin` value.
    function renew(uint256 id, address coin) external;

    /// @notice Grows the accumulator's `x128` value.
    /// @dev The function can be called by any account, but is expected to be called by the emulator contract.
    function grow(address coin) external returns (uint128 dy);
}
