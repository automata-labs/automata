// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../interfaces/IComputer.sol";

/// @title Linear
contract Linear is IComputer {
    /// @inheritdoc IComputer
    function compute(uint128 m, uint128 x, uint128 y) external pure returns (uint8, uint256) {
        if (x > y) {
            return (uint8(1), Math.min(m, x - y));
        } else if (x < y) {
            return (uint8(0), Math.min(m, y - x));
        } else {
            return (uint8(0), 0);
        }
    }
}
