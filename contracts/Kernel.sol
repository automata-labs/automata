// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IKernel.sol";
import "./interfaces/IKernelEvents.sol";

import "./libraries/access/Access.sol";
import "./libraries/data/Slot.sol";
import "./libraries/utils/Multicall.sol";

/// @title Kernel
contract Kernel is IKernel, IKernelEvents, Access, Multicall {
    /// @inheritdoc IKernel
    mapping(bytes32 => Slot.Data) public override slots;

    /// @inheritdoc IKernel
    function get(bytes32 key) external view override returns (Slot.Data memory) {
        return slots[key];
    }

    /// @inheritdoc IKernel
    function set(bytes32 key, uint128 x, uint128 y) external override auth {
        slots[key].x = x;
        slots[key].y = y;
        emit Set(msg.sender, key, x, y);
    }

    /// @inheritdoc IKernel
    function update(bytes32 key, int128 delx, int128 dely) external override auth {
        if (delx > 0) slots[key].x += uint128(delx);
        if (delx < 0) {
            require(slots[key].x >= uint128(-delx), "-");
            unchecked { slots[key].x -= uint128(-delx); }
        }
        if (dely > 0) slots[key].y += uint128(dely);
        if (dely < 0) {
            require(slots[key].y >= uint128(-dely), "-");
            unchecked { slots[key].y -= uint128(-dely); }
        }

        emit Updated(msg.sender, key, delx, dely);
    }

    /// @inheritdoc IKernel
    function transfer(bytes32 from, bytes32 to, uint128 x, uint128 y) external override auth {
        require(slots[from].x >= x, "X");
        require(slots[from].y >= y, "Y");
        unchecked {
            slots[from].x -= x;
            slots[from].y -= y;
        }
        slots[to].x += x;
        slots[to].y += y;

        emit Transferred(msg.sender, from, to, x, y);
    }
}
