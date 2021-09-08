// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./shard/IShardEvents.sol";
import "./shard/IShardFunctions.sol";

interface IShard is
    IShardFunctions,
    IShardEvents
{}
