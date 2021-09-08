// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./accumulator/IAccumulatorEvents.sol";
import "./accumulator/IAccumulatorFunctions.sol";
import "./accumulator/IAccumulatorImmutables.sol";
import "./accumulator/IAccumulatorState.sol";

interface IAccumulator is
    IAccumulatorImmutables,
    IAccumulatorState,
    IAccumulatorFunctions,
    IAccumulatorEvents
{}
