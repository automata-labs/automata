// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerFactory {
    /// @notice The parameters for tweaking the created sequencer traniently.
    function parameters() external view returns (address token);

    /// @notice Creates a sequencer.
    function create(address token) external;

    /// @notice Deterministically compute the sequencer address from a token address.
    /// @dev Create2 calculation
    function compute(address token) external view returns (address);
}