// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IShard {
    /// @notice Initializes the shard with `msg.sender` as the sequencer.
    /// @dev Should be called by the sequencer in the same call as the creation call
    function initialize() external;

    /// @dev Transfer tokens from the shard to a destination.
    function safeTransfer(address token, address to, uint256 amount) external;

    /// @notice Execute a transaction batch
    function execute(
        address[] calldata targets,
        bytes[] calldata data
    ) external returns (bytes[] memory results);
}
