// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IComputer {
    function compute(uint128 x, uint128 y) external pure returns (uint8, uint256);
}
