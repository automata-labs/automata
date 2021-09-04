// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "hardhat/console.sol";

abstract contract Lock {
    bool public unlocked = true; // unlocked at creation

    modifier lock() {
        require(unlocked, "LOK");
        unlocked = false;
        _;
        unlocked = true;
    }
}