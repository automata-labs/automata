// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./sequencerfactory/ISequencerFactoryEvents.sol";
import "./sequencerfactory/ISequencerFactoryFunctions.sol";
import "./sequencerfactory/ISequencerFactoryState.sol";
import "./sequencerfactory/ISequencerFactoryStateDerived.sol";

interface ISequencerFactory is
    ISequencerFactoryState,
    ISequencerFactoryStateDerived,
    ISequencerFactoryFunctions,
    ISequencerFactoryEvents
{}
