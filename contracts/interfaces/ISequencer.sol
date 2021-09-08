// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./sequencer/ISequencerEvents.sol";
import "./sequencer/ISequencerFunctions.sol";
import "./sequencer/ISequencerImmutables.sol";
import "./sequencer/ISequencerState.sol";
import "./sequencer/ISequencerStateDerived.sol";

interface ISequencer is
    ISequencerImmutables,
    ISequencerState,
    ISequencerStateDerived,
    ISequencerFunctions,
    ISequencerEvents
{}
