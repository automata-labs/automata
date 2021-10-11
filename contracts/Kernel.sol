// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IKernel.sol";

import "./libraries/access/AccessControl.sol";
import "./libraries/data/Slot.sol";

/// @title Kernel
contract Kernel is IKernel, AccessControl {
    /// @inheritdoc IKernelState
    mapping(bytes32 => Slot.Data) public slots;

    /// @inheritdoc IKernelStateDerived
    function read(bytes32 key) external view returns (Slot.Data memory) {
        return slots[key];
    }

    /// @inheritdoc IKernelFunctions
    function write(bytes32 key, uint128 x, uint128 y) external auth {
        slots[key].x = x;
        slots[key].y = y;

        emit Written(key, x, y);
    }

    /// @inheritdoc IKernelFunctions
    function update(bytes32 key, int128 dx, int128 dy) external auth returns (Slot.Data memory) {
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

        emit Updated(key, dx, dy);

        return slots[key];
    }

    /// @inheritdoc IKernelFunctions
    function transfer(bytes32 from, bytes32 to, uint128 x, uint128 y) external auth {
        require(slots[from].x >= x, "-");
        require(slots[from].y >= y, "-");
        unchecked {
            slots[from].x -= x;
            slots[from].y -= y;
        }
        slots[to].x += x;
        slots[to].y += y;

        emit Transferred(from, to, x, y);
    }
}
