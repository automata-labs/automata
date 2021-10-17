// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IShardFunctions {
    /// @notice Initializes the shard with `msg.sender` as the sequencer.
    /// @dev Should be called by the sequencer in the same call as the creation call
    function initialize() external;

    /// @dev Transfer tokens from the shard to a destination.
    function transfer(address coin, address to, uint256 amount) external;

    /// @notice Delegate votes from the shard to an address.
    /// @dev Uses the ERC20CompLike interface. Upon token upgrade, use the `execute` function.
    function delegate(address coin, address delegatee) external;

    /// @notice Execute a transaction batch
    function execute(
        address[] calldata targets,
        bytes[] calldata data
    ) external returns (bytes[] memory results);
}
