// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./data/Slot.sol";
import "../interfaces/IKernel.sol";

library Shell {
    /// @notice Returns a slot as a struct.
    /// @param kernel The kernel.
    /// @param coin The token address.
    /// @param owner The owner of the slot.
    function get(IKernel kernel, address coin, address owner) internal view returns (Slot.Data memory) {
        return kernel.read(keccak256(abi.encode(coin, owner)));
    }

    /// @notice Returns a slot as a pair.
    /// @param kernel The kernel.
    /// @param coin The token address.
    /// @param owner The owner of the slot.
    function slot(IKernel kernel, address coin, address owner) internal view returns (uint128 x, uint128 y) {
        return kernel.slots(keccak256(abi.encode(coin, owner)));
    }

    /// @notice Updates- and returns the pool's `x` value.
    /// @param kernel The kernel.
    /// @param coin The token address.
    /// @param dx The `x` delta.
    function pool(IKernel kernel, address coin, int128 dx) internal returns (uint128) {
        return kernel.update(keccak256(abi.encode(address(kernel), coin)), dx, 0).x;
    }

    /// @notice Sum deltas for a user state.
    /// @param kernel The kernel.
    /// @param coin The token address.
    /// @param owner The owner of the state.
    /// @param dx The `x` delta.
    /// @param dy The `y` delta.
    function modify(IKernel kernel, address coin, address owner, int128 dx, int128 dy) internal {
        kernel.update(keccak256(abi.encode(coin, owner)), dx, dy);
    }

    /// @notice Transfer `x` and `y` from one address to another.
    /// @param kernel The kernel.
    /// @param coin The token address.
    /// @param from The sender address.
    /// @param to The recipieint address.
    /// @param x The amount of `x` to send.
    /// @param y The amount of `y` to send.
    function transfer(IKernel kernel, address coin, address from, address to, uint128 x, uint128 y) internal {
        kernel.transfer(keccak256(abi.encode(coin, from)), keccak256(abi.encode(coin, to)), x, y);
    }
}
