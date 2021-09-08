// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../IKernel.sol";

interface IOperatorImmutables {
    /// @notice Returns the immutable kernel.
    function kernel() external view returns (IKernel);

    /// @notice Returns the underlying token.
    function underlying() external view returns (address);
}
