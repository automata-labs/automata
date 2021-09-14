// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOperatorFunctions {
    /// @notice Set a key-value.
    function set(bytes32 key, bytes memory data) external;

    /// @notice Deposit tokens to use the protocol.
    /// @dev Requires the account to send tokens to the operator's sequencer.
    function virtualize(address toX, address toY) external;

    /// @notice Exit the protocol and withdraw tokens.
    /// @dev Requires the account to send `x` and `y` values to the operator, and then calling `exit`.
    function realize(address to) external;

    /// @notice Move internal values from `msg.sender` to an address.
    /// @dev Can only move values inside of the current key space (i.e. w.r.t. `underlying`).
    function transfer(address to, uint128 x, uint128 y) external;

    /// @notice Helper transfer function.
    function pay(address token, address to, uint256 value) external;
}
