// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IEmulator.sol";

import "@yield-protocol/utils-v2/contracts/token/IERC20Metadata.sol";

import "./interfaces/IAccumulator.sol";
import "./interfaces/ISequencer.sol";
import "./libraries/proxy/ERC1967Proxy.sol";

/// @title Emulator
contract Emulator is IEmulator, ERC1967Proxy {
    /// @inheritdoc IEmulatorImmutables
    IAccumulator public immutable override accumulator;
    /// @inheritdoc IEmulatorImmutables
    address public immutable override underlying;
    /// @inheritdoc IEmulatorImmutables
    uint8 public immutable override decimals;

    constructor(
        address rom,
        bytes memory datas, 
        IAccumulator accumulator_,
        address underlying_
    ) ERC1967Proxy(rom, datas) {
        accumulator = accumulator_;
        underlying = underlying_;
        decimals = IERC20Metadata(underlying_).decimals();
    }
}
