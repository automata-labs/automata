// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOperatorFactoryStateDerived {
    /// @notice Deterministically compute the sequencer address from a token address.
    /// @dev Create2 calculation
    function compute(address token) external view returns (address);
}
