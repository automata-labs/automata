// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./operatorfactory/IOperatorFactoryEvents.sol";
import "./operatorfactory/IOperatorFactoryFunctions.sol";
import "./operatorfactory/IOperatorFactoryImmutables.sol";
import "./operatorfactory/IOperatorFactoryState.sol";
import "./operatorfactory/IOperatorFactoryStateDerived.sol";

interface IOperatorFactory is
    IOperatorFactoryEvents,
    IOperatorFactoryFunctions,
    IOperatorFactoryImmutables,
    IOperatorFactoryState,
    IOperatorFactoryStateDerived
{}
