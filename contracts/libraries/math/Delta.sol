// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

library Delta {
    function addDelta(uint128 x, int128 y) internal pure returns (uint128 z) {
        if (y < 0) {
            require((z = x - uint128(-y)) < x, "LS");
        } else {
            require((z = x + uint128(y)) >= x, "LA");
        }
    }

    function addDelta112(uint112 x, int112 y) internal pure returns (uint112 z) {
        if (y < 0) {
            require((z = x - uint112(-y)) < x, "LS");
        } else {
            require((z = x + uint112(y)) >= x, "LA");
        }
    }
}
