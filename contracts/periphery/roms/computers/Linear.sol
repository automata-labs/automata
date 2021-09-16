// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract Linear {
    function compute(uint128 x, uint128 y) external pure returns (uint8, uint256) {
        if (x > y) {
            return (uint8(1), x - y);
        } else if (x < y) {
            return (uint8(0), y - x);
        } else {
            return (uint8(0), 0);
        }
    }
}
