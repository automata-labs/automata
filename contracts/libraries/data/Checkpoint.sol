// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library Checkpoint {
    struct Data {
        uint256 cursor;
        uint256 votes;
    }
}
