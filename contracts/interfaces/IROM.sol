// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./emulator/IEmulatorImmutables.sol";
import "./rom/IROMFunctions.sol";
import "./rom/IROMState.sol";
import "./rom/IROMStateDerived.sol";

interface IROM is
    IEmulatorImmutables,
    IROMState,
    IROMStateDerived,
    IROMFunctions
{}
