// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Cast {
    function u128(uint256 value) internal pure returns (uint128) {
        require(value <= type(uint128).max, "U128");
        return uint128(value);
    }

    function u128(int128 value) internal pure returns (uint128) {
        require(value <= type(int128).max, "U128");
        return uint128(value);
    }

    function u112(uint256 value) internal pure returns (uint112) {
        require(value <= type(uint112).max, "U112");
        return uint112(value);
    }

    function i128(uint128 value) internal pure returns (int128) {
        require(value <= uint128(type(int128).max), "I128");
        return int128(value);
    }

    function i112(uint112 value) internal pure returns (int112) {
        require(value <= uint112(type(int112).max), "I112");
        return int112(value);
    }
}