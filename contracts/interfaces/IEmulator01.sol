// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./emulator01/IEmulator01Immutables.sol";
import "./emulator01/IEmulator01Functions.sol";
import "./emulator01/IEmulator01State.sol";
import "./emulator01/IEmulator01StateDerived.sol";

interface IEmulator01 is
    IEmulator01Immutables,
    IEmulator01State,
    IEmulator01StateDerived,
    IEmulator01Functions
{}
