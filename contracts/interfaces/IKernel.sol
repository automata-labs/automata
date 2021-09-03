// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../libraries/data/State.sol";

interface IKernel {
    /// @notice The mapping from key to state.
    function states(bytes32 key) external view returns (uint128 x, uint128 y);

    /// @notice Returns a state.
    function get(bytes32 key) external view returns (State.Data memory);

    /// @notice Set a state.
    /// @dev Requires authorization.
    function set(bytes32 key, State.Data memory state) external;

    /// @notice Updates a state.
    /// @dev Requires authorization. Updates the state by deltas and reverts on negative underflow.
    function update(bytes32 key, int128 deltaX, int128 deltaY) external;

    /// @notice Transfer `x` or `y` from one key to another.
    /// @dev Requires authorization.
    ///      Ensure that the authorized contracts do not illegally send values between different key spaces.
    function transfer(bytes32 from, bytes32 to, uint128 x, uint128 y) external;
}
