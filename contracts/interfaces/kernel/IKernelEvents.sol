// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IKernelEvents {
    /// @notice Emitted when a slot is set.
    event Set(address sender, bytes32 key, uint128 x, uint128 y);

    /// @notice Emitted when a slot is updated.
    event Updated(address sender, bytes32 key, int128 delx, int128 dely);

    /// @notice Emitted when `x` or `y` is transferred from one slot to another.
    event Transferred(address sender, bytes32 from, bytes32 to, uint128 x, uint128 y);
}
