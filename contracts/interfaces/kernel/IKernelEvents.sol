// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IKernelEvents {
    /// @notice Emitted when a slot is written to.
    event Written(bytes32 indexed key, uint128 x, uint128 y);

    /// @notice Emitted when a slot is updated.
    event Updated(bytes32 indexed key, int128 delx, int128 dely);

    /// @notice Emitted when `x` or `y` is transferred from one slot to another.
    event Transferred(bytes32 indexed from, bytes32 indexed to, uint128 x, uint128 y);
}
