// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../data/Slot.sol";
import "../../interfaces/IKernel.sol";

library Shell {
    function get(IKernel kernel, address coin, address owner) internal view returns (Slot.Data memory) {
        return kernel.read(keccak256(abi.encode(coin, owner)));
    }

    function pool(IKernel kernel, address coin, int128 d) internal returns (uint128) {
        return kernel.update(keccak256(abi.encode(address(kernel), coin)), d, 0).x;
    }

    function modify(IKernel kernel, address coin, address owner, int128 dx, int128 dy) internal {
        kernel.update(keccak256(abi.encode(coin, owner)), dx, dy);
    }

    function transfer(IKernel kernel, address coin, address from, address to, uint128 x, uint128 y) internal {
        kernel.transfer(keccak256(abi.encode(coin, from)), keccak256(abi.encode(coin, to)), x, y);
    }
}
