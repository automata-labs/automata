// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOperatorEvents {
    /// @notice Emitted when a variable is set.
    /// @param sender The address that set a variable.
    /// @param selector The function selector of the variable that is set.
    /// @param data The data to set the selector to.
    event Set(address sender, bytes4 indexed selector, bytes data);

    /// @notice Emitted when `join` is called.
    /// @param sender The address that joined tokens.
    /// @param tox The address that receives the x.
    /// @param toy The address that receives the y.
    /// @param amount The amount of coins that got joined.
    event Joined(address indexed sender, address tox, address toy, uint128 amount);

    /// @notice Emitted when `exit` is called.
    /// @param sender The address that exited the operator.
    /// @param to The address the tokens are exited to.
    /// @param amount The amount of tokens exited.
    event Exited(address indexed sender, address to, uint128 amount);

    /// @notice Emitted when `transfer` is called.
    /// @param sender The address that transferred values.
    /// @param to The address that received `x`.
    /// @param x The amount of `x` sent.
    /// @param y The amount of `y` sent.
    event Transferred(address indexed sender, address indexed to, uint128 x, uint128 y);

    /// @notice Emitted when `use` is called.
    /// @param sender The address that cast the votes internally.
    /// @param pid The proposal id that is voted on.
    /// @param support The supported side the sender took.
    event Used(address indexed sender, uint256 indexed pid, uint8 support);

    /// @notice Emitted when `route` is called.
    /// @param sender The address that triggered the routing.
    /// @param pid The proposal id that the votes are routed to.
    /// @param cursor The cursor of the shard that routed the votes.
    event Routed(address indexed sender, uint256 indexed pid, uint256 cursor);
}
