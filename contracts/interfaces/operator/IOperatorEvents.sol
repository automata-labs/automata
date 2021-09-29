// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOperatorEvents {
    /// @notice Emitted when the sequencer is set.
    event Set(address sender, address sequencer);

    /// @notice Emitted when `join` is called.
    event Joined(address sender, address tox, address toy, uint128 amount);

    /// @notice Emitted when `exit` is called.
    event Exited(address sender, address to, uint128 amount);

    /// @notice Emitted when `use` is called.
    event Used(address sender, uint256 pid, uint8 support);

    /// @notice Emitted when `route` is called.
    event Routed(address sender, uint256 pid, uint256 cursor);
}
