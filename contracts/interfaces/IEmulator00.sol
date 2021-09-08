// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./emulator00/IEmulator00Immutables.sol";
import "./emulator00/IEmulator00Functions.sol";
import "./emulator00/IEmulator00State.sol";
import "./emulator00/IEmulator00StateDerived.sol";

interface IEmulator00 is
    IEmulator00Immutables,
    IEmulator00State,
    IEmulator00StateDerived,
    IEmulator00Functions
{}
