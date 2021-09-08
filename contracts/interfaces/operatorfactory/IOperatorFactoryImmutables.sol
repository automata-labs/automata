// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../IKernel.sol";

interface IOperatorFactoryImmutables {
    /// @notice Returns the kernel contract.
    function kernel() external view returns (IKernel);
}
