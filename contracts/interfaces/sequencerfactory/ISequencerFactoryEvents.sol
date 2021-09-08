// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISequencerFactoryEvents {
    /// @notice Emitted when a sequencer is created.
    event Created(address token, address sequencer);
}
