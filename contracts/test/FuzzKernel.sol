// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../libraries/math/Delta.sol";
import "../Kernel.sol";

contract Other {}

contract FuzzKernel {
    using Delta for uint128;

    event AssertionFailed();

    IKernel internal kernel;
    bytes32 internal other;

    constructor() {
        kernel = new Kernel();
        other = keccak256(abi.encodePacked(new Other()));
    }

    function write(uint128 x, uint128 y) public {
        bytes32 self = keccak256(abi.encodePacked(address(this)));
        kernel.write(self, x, y);
        if (kernel.read(self).x != x) emit AssertionFailed();
        if (kernel.read(self).y != y) emit AssertionFailed();
    }

    function update(int128 dx, int128 dy) public {
        bytes32 self = keccak256(abi.encodePacked(address(this)));
        uint128 x = kernel.read(self).x;
        uint128 y = kernel.read(self).y;
        kernel.update(self, dx, dy);
        uint128 xt = kernel.read(self).x;
        uint128 yt = kernel.read(self).y;
        if (xt != x.addDelta(dx)) emit AssertionFailed();
        if (yt != y.addDelta(dy)) emit AssertionFailed();
    }

    function transfer(uint128 x, uint128 y) public {
        bytes32 self = keccak256(abi.encodePacked(address(this)));
        uint128 x00 = kernel.read(self).x;
        uint128 y00 = kernel.read(self).y;
        uint128 x10 = kernel.read(other).x;
        uint128 y10 = kernel.read(other).y;
        kernel.transfer(self, other, x, y);
        uint128 x01 = kernel.read(self).x;
        uint128 y01 = kernel.read(self).y;
        uint128 x11 = kernel.read(other).x;
        uint128 y11 = kernel.read(other).y;
        if (x00 - x != x01) emit AssertionFailed();
        if (y00 - y != y01) emit AssertionFailed();
        if (x10 + x != x11) emit AssertionFailed();
        if (y10 + y != y11) emit AssertionFailed();
    }
}
