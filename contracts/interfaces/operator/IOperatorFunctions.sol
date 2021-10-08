// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOperatorFunctions {
    /// @notice Set a key-value.
    function set(bytes4 selector, bytes memory data) external;

    /// @notice Deposit tokens to use the protocol.
    /// @dev Requires the account to send tokens to the operator's sequencer.
    function join(address tox, address toy) external returns (uint128 amount);

    /// @notice Exit the protocol and withdraw tokens.
    /// @dev Requires the account to send `x` and `y` values to the operator, and then calling `exit`.
    function exit(address to) external returns (uint128 amount);

    /// @notice Move internal values from `msg.sender` to an address.
    /// @dev Can only move values inside of the current key space (i.e. w.r.t. `coin`).
    function transfer(address to, uint128 x, uint128 y) external;

    /// @notice Sum votes before the votes are cast by the protocol.
    function use(uint256 pid, uint8 support) external returns (uint128 amount);

    /// @notice Trigger the protocol to cast votes with a specified cursor.
    function route(uint256 pid, uint256 cursor) external;
}
