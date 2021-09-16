// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IEmulator.sol";

import "@yield-protocol/utils-v2/contracts/token/IERC20Metadata.sol";

import "./interfaces/ISequencer.sol";
import "./libraries/access/Access.sol";
import "./libraries/proxy/ERC1967Proxy.sol";

/// @title Emulator
contract Emulator is IEmulator, ERC1967Proxy, Access {
    /// @inheritdoc IEmulatorImmutables
    address public immutable override underlying;
    /// @inheritdoc IEmulatorImmutables
    uint8 public immutable override decimals;

    constructor(
        address rom,
        bytes memory datas,
        address underlying_
    ) ERC1967Proxy(rom, datas) {
        underlying = underlying_;
        decimals = IERC20Metadata(underlying_).decimals();
    }
}
