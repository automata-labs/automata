// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IKernel.sol";
import "./ISequencer.sol";

interface IOperator {
    /// @notice Returns the immutable kernel.
    function kernel() external view returns (IKernel);

    /// @notice Returns the underlying token.
    function underlying() external view returns (address);

    /// @notice Returns the sequencer.
    function sequencer() external view returns (ISequencer);

    /// @notice Set the sequencer.
    /// @dev The sequencer is also the storage of all the governance tokens.
    function set(ISequencer sequencer_) external;

    /// @notice Deposit tokens to join the protocol.
    /// @dev Requires the account to send tokens to the operator's sequencer.
    function join(address toX, address toY) external;

    /// @notice Exit the protocol and withdraw tokens.
    /// @dev Requires the account to send `x` and `y` values to the operator, and then calling `exit`.
    function exit(address to) external;

    /// @notice Helper transfer function.
    function pay(address token, address to, uint256 value) external;
}