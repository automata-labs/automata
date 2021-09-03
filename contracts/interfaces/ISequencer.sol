// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencer {
    /// @notice Returns the underlying token.
    function underlying() external view returns (address);

    /// @notice Returns the decimals of the underlying token.
    function decimals() external view returns (uint256);

    /// @notice Returns the shard contract implementation.
    function implementation() external view returns (address);

    /// @notice Returns a shard from a cursor.
    function shards(uint256 cursor) external view returns (address);

    /// @notice Returns a cursor from a shard.
    function cursors(address shard) external view returns (uint256);

    /// @notice Returns the total amount of tokens sequenced into the sequencer's shards.
    function liquidity() external view returns (uint256);

    /// @notice Returns the current number of shards.
    function cardinality() external view returns (uint256);

    /// @notice Returns the max number of shards that can be cloned.
    function cardinalityMax() external view returns (uint256);

    /// @notice Returns a deterministically computed the shard addresses.
    function compute(uint256 cursor) external view returns (address);

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
    function sequence() external returns (uint256 amount);

    /// @notice Withdraw tokens into the sequencer's shards.
    function withdraw(address to, uint256 amount) external returns (uint256 withdrawn);

    /// @notice Execute a transaction batch on a shard.
    function execute(
        uint256 cursor,
        address[] calldata targets,
        bytes[] calldata data
    ) external returns (bytes[] memory);
}
