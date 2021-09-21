// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./operator/IOperatorEvents.sol";
import "./operator/IOperatorFunctions.sol";
import "./operator/IOperatorImmutables.sol";
import "./operator/IOperatorState.sol";
import "./operator/IOperatorStateDerived.sol";

interface IOperator is
    IOperatorImmutables,
    IOperatorState,
    IOperatorStateDerived,
    IOperatorFunctions,
    IOperatorEvents
{}
