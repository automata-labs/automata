// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOperatorFactoryEvents {
    /// @notice Emitted when a operator is created.
    event Created(address token, address operator);
}