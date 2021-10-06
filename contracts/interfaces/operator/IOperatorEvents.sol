// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOperatorEvents {
    /// @notice Emitted when a variable is set.
    event Set(address indexed sender, bytes4 indexed selector, bytes data);

    /// @notice Emitted when `join` is called.
    event Joined(address indexed sender, address indexed tox, address indexed toy, uint128 amount);

    /// @notice Emitted when `exit` is called.
    event Exited(address indexed sender, address indexed to, uint128 amount);

    /// @notice Emitted when `transfer` is called.
    event Transferred(address indexed sender, address indexed to, uint128 x, uint128 y);

    /// @notice Emitted when `use` is called.
    event Used(address indexed sender, uint256 indexed pid, uint8 support);

    /// @notice Emitted when `route` is called.
    event Routed(address indexed sender, uint256 indexed pid, uint256 cursor);
}
