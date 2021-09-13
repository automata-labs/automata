// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../libraries/data/Slot.sol";

interface IKernelStateDerived {
    /// @notice Returns a slot.
    function read(bytes32 key) external view returns (Slot.Data memory);
}
