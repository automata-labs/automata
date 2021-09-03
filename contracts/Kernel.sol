// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IKernel.sol";

import "./libraries/access/Access.sol";
import "./libraries/data/State.sol";
import "./libraries/math/Cast.sol";
import "./libraries/math/Delta.sol";
import "./libraries/utils/Multicall.sol";

/// @title Kernel
contract Kernel is IKernel, Access, Multicall {
    using Cast for uint128;
    using Delta for uint128;

    /// @inheritdoc IKernel
    mapping(bytes32 => State.Data) public override states;

    /// @inheritdoc IKernel
    function get(bytes32 key) external view override returns (State.Data memory) {
        return states[key];
    }

    /// @inheritdoc IKernel
    function set(bytes32 key, State.Data memory state) external override auth {
        states[key] = state;
    }

    /// @inheritdoc IKernel
    function update(bytes32 key, int128 deltaX, int128 deltaY) external override auth {
        _delta(key, deltaX, deltaY);
    }

    /// @inheritdoc IKernel
    function transfer(bytes32 from, bytes32 to, uint128 x, uint128 y) external override auth {
        _delta(from, -x.i128(), -y.i128());
        _delta(to, x.i128(), y.i128());
    }

    function _delta(bytes32 key, int128 deltaX, int128 deltaY) internal {
        if (deltaX != 0) states[key].x = states[key].x.addDelta(deltaX);
        if (deltaY != 0) states[key].y = states[key].y.addDelta(deltaY);
    }
}
