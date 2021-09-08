// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IKernelState {
    /// @notice The mapping from a key to a slot.
    function slots(bytes32 key) external view returns (uint128 x, uint128 y);
}
