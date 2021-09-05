// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../data/Slot.sol";
import "../../interfaces/IKernel.sol";

library Shell {
    function fetch(IKernel kernel, address underlying, address owner) internal view returns (Slot.Data memory) {
        return kernel.get(keccak256(abi.encode(underlying, owner)));
    }

    function modify(IKernel kernel, address underlying, address owner, int128 deltaX, int128 deltaY) internal {
        kernel.update(keccak256(abi.encode(underlying, owner)), deltaX, deltaY);
    }

    function move(IKernel kernel, address underlying, address from, address to, uint128 x, uint128 y) internal {
        kernel.transfer(keccak256(abi.encode(underlying, from)), keccak256(abi.encode(underlying, to)), x, y);
    }
}
