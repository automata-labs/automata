// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerFunctions {
    /// @notice Clones a shard from the `implementation`.
    /// @dev Cloning a shard requires the `msg.sender` to send 1 unit of token to the shard. This saves gas costs for
    ///      future calls of `sequence` or `withdraw` as the storage will have been initialized.
    ///      Increments `cardinality` by 1.
    function clone() external returns (uint256, address);

    /// @notice Clone(s) a shard(s).
    /// @dev Increments `cardinality` by `amount`.
    function clones(uint256 amount) external returns (
        uint256[] memory cursored,
        address[] memory cloned
    );

    /// @notice Deposit tokens into the sequencer's shards.
    function deposit() external returns (uint256 amount);

    /// @notice Withdraw tokens into the sequencer's shards.
    function withdraw(address to, uint256 amount) external;

    /// @notice Execute a transaction batch on a shard.
    function execute(
        uint256 cursor,
        address[] calldata targets,
        bytes[] calldata data
    ) external returns (bytes[] memory);
}
