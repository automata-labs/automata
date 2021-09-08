// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./kernel/IKernelEvents.sol";
import "./kernel/IKernelFunctions.sol";
import "./kernel/IKernelState.sol";
import "./kernel/IKernelStateDerived.sol";

interface IKernel is
    IKernelState,
    IKernelStateDerived,
    IKernelFunctions,
    IKernelEvents
{}
