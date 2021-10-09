// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IKernelEvents {
    /// @notice Emitted when a slot is written to.
    /// @param key The key.
    /// @param x The x value.
    /// @param y The y value.
    event Written(bytes32 indexed key, uint128 x, uint128 y);

    /// @notice Emitted when a slot is updated.
    /// @param key The key.
    /// @param dx The x delta.
    /// @param dy The y delta.
    event Updated(bytes32 indexed key, int128 dx, int128 dy);

    /// @notice Emitted when `x` or `y` is transferred from one slot to another.
    /// @param from The from key.
    /// @param to The to key.
    /// @param to The amount of x to transfer.
    /// @param to The amount of y to transfer.
    event Transferred(bytes32 indexed from, bytes32 indexed to, uint128 x, uint128 y);
}
