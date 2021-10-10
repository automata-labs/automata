// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../interfaces/IComputer.sol";
import "../../libraries/math/Babylonian.sol";

/// @title Root
contract Root is IComputer {
    /// @inheritdoc IComputer
    function compute(uint128 m, uint128 x, uint128 y) external pure returns (uint8, uint256) {
        uint8 s = (x > y) ? uint8(1) : uint8(0);
        uint256 z = (x > y) ? x - y : y - x;

        if (z <= m / 4) {
            return (s, Math.min(m, Babylonian.sqrt(m * z)));
        } else {
            return (s, Math.min(m, m / 2 + (z - m / 4)));
        }
    }
}
