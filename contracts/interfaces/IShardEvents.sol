// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IShardEvents {
    /// @notice Emitted when initialized.
    event Initialized();

    /// @notice Emitted when arbitrary transaction is executed.
    event Executed(bytes32 indexed txHash, address[] indexed targets, bytes[] data);
}
