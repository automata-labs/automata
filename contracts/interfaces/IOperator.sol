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
    /// @dev The sequencer is manages the protocol owned tokens.
    function sequencer() external view returns (ISequencer);

    /// @notice Returns the external governor address.
    function governor() external view returns (address);

    /// @notice Returns the frozen state of the operator.
    /// @dev If the operator is frozen, the `virtualize` function is disabled.
    function frozen() external view returns (uint256, bool);

    /// @notice Freeze the operator.
    function freeze(uint256 pid) external;

    /// @notice Unfreeze the operator.
    function unfreeze() external;

    /// @notice Deposit tokens to use the protocol.
    /// @dev Requires the account to send tokens to the operator's sequencer.
    function virtualize(address toX, address toY) external;

    /// @notice Exit the protocol and withdraw tokens.
    /// @dev Requires the account to send `x` and `y` values to the operator, and then calling `exit`.
    function realize(address to) external;

    /// @notice Move internal values from msg.sender to an address.
    /// @dev Can only move values inside of the current key space (i.e. w.r.t. `underlying`).
    function transfer(address to, uint128 x, uint128 y) external;

    /// @notice Helper transfer function.
    function pay(address token, address to, uint256 value) external;
}
