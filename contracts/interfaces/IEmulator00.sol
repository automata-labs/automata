// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./emulator00/IEmulator00DerivedState.sol";
import "./emulator00/IEmulator00Immutables.sol";
import "./emulator00/IEmulator00State.sol";
import "./emulator00/IEmulator00Functions.sol";

interface IEmulator00 is
    IEmulator00Immutables,
    IEmulator00State,
    IEmulator00DerivedState,
    IEmulator00Functions
{}
