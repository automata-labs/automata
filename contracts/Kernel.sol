// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IKernel.sol";
import "./interfaces/IKernelEvents.sol";

import "./libraries/access/Access.sol";
import "./libraries/data/State.sol";
import "./libraries/math/Cast.sol";
import "./libraries/math/Delta.sol";
import "./libraries/utils/Multicall.sol";

/// @title Kernel
contract Kernel is IKernel, IKernelEvents, Access, Multicall {
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
        emit Set(msg.sender, key, state);
    }

    /// @inheritdoc IKernel
    function update(bytes32 key, int128 delx, int128 dely) external override auth {
        if (delx != 0) states[key].x = states[key].x.addDelta(delx);
        if (dely != 0) states[key].y = states[key].y.addDelta(dely);

        emit Updated(msg.sender, key, delx, dely);
    }

    /// @inheritdoc IKernel
    function transfer(bytes32 from, bytes32 to, uint128 x, uint128 y) external override auth {
        require(states[from].x >= x, "X");
        require(states[from].y >= y, "Y");
        unchecked {
            states[from].x = states[from].x - x;
            states[from].y = states[from].y - y;
        }
        states[to].x = states[to].x + x;
        states[to].y = states[to].y + y;

        emit Transferred(msg.sender, from, to, x, y);
    }
}
