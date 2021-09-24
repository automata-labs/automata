// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../data/Slot.sol";
import "../../interfaces/IKernel.sol";

library Shell {
    function get(IKernel kernel, address underlying, address owner) internal view returns (Slot.Data memory) {
        return kernel.read(keccak256(abi.encode(underlying, owner)));
    }

    // function level(IKernel kernel, address underlying) internal view returns (uint128) {
    //     return kernel.read(keccak256(abi.encode(address(kernel), underlying))).x;
    // }

    function pool(IKernel kernel, address underlying, int128 d) internal returns (uint128) {
        return kernel.update(keccak256(abi.encode(address(kernel), underlying)), d, 0).x;
    }

    function modify(IKernel kernel, address underlying, address owner, int128 dx, int128 dy) internal {
        kernel.update(keccak256(abi.encode(underlying, owner)), dx, dy);
    }

    function transfer(IKernel kernel, address underlying, address from, address to, uint128 x, uint128 y) internal {
        kernel.transfer(keccak256(abi.encode(underlying, from)), keccak256(abi.encode(underlying, to)), x, y);
    }
}
