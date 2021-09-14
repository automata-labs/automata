// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./operator/IOperatorImmutables.sol";
import "./operator/IOperatorState.sol";
import "./observer/IObserverFunctions.sol";

interface IObserver is
    IOperatorImmutables,
    IOperatorState,
    IObserverFunctions
{}
