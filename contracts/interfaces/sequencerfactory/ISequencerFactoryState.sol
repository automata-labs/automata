// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerFactoryState {
    /// @notice The parameters for tweaking the created sequencer traniently.
    function parameters() external view returns (address token);
}
