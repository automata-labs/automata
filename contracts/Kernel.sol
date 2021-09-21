// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IKernel.sol";

import "./libraries/access/Access.sol";
import "./libraries/data/Slot.sol";

/// @title Kernel
contract Kernel is IKernel, Access {
    /// @inheritdoc IKernelState
    mapping(bytes32 => Slot.Data) public override slots;

    /// @inheritdoc IKernelStateDerived
    function read(bytes32 key) external view override returns (Slot.Data memory) {
        return slots[key];
    }

    /// @inheritdoc IKernelFunctions
    function write(bytes32 key, uint128 x, uint128 y) external override auth {
        slots[key].x = x;
        slots[key].y = y;

        emit Written(msg.sender, key, x, y);
    }

    /// @inheritdoc IKernelFunctions
    function update(bytes32 key, int128 dx, int128 dy) external override auth {
        if (dx > 0) slots[key].x += uint128(dx);
        if (dx < 0) {
            require(slots[key].x >= uint128(-dx), "-");
            unchecked { slots[key].x -= uint128(-dx); }
        }
        if (dy > 0) slots[key].y += uint128(dy);
        if (dy < 0) {
            require(slots[key].y >= uint128(-dy), "-");
            unchecked { slots[key].y -= uint128(-dy); }
        }

        emit Updated(msg.sender, key, dx, dy);
    }

    /// @inheritdoc IKernelFunctions
    function transfer(bytes32 from, bytes32 to, uint128 x, uint128 y) external override auth {
        require(slots[from].x >= x, "-");
        require(slots[from].y >= y, "-");
        unchecked {
            slots[from].x -= x;
            slots[from].y -= y;
        }
        slots[to].x += x;
        slots[to].y += y;

        emit Transferred(msg.sender, from, to, x, y);
    }
}
