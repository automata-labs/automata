// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

abstract contract Lock {
    bool public unlocked = true; // unlocked at creation

    modifier lock() {
        require(unlocked, "LOK");
        unlocked = false;
        _;
        unlocked = true;
    }
}
