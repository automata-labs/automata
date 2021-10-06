// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOperatorImmutables {
    /// @notice Returns the immutable coin token.
    function coin() external view returns (address);

    /// @notice Returns the immutable kernel.
    function kernel() external view returns (address);
}
