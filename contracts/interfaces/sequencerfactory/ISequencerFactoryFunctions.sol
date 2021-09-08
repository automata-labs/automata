// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerFactoryFunctions {
    /// @notice Creates a sequencer.
    function create(address token) external;
}
