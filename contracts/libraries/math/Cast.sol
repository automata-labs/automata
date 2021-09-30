// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Cast {
    function u128(uint256 value) internal pure returns (uint128) {
        require(value <= type(uint128).max, "U128");
        return uint128(value);
    }

    function i128(uint128 value) internal pure returns (int128) {
        require(value <= uint128(type(int128).max), "I128");
        return int128(value);
    }
}
