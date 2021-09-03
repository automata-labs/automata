// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@uniswap/v3-core/contracts/libraries/BitMath.sol";

library Cursor {
    function computeCursor(uint256 liquidity, uint256 decimals) internal pure returns (uint256) {
        uint256 value = liquidity / (uint256(10) ** decimals);
        if (value == 0) {
            return 0;
        } else {
            uint256 mostSignificantBit = BitMath.mostSignificantBit(value);
            return (((value + 1) & value) == 0) ? mostSignificantBit + 1 : mostSignificantBit;
        }
    }

    function computeGlobalComplement(uint256 liquidity, uint256 decimals, uint256 cursor) internal pure returns (uint256) {
        return (uint256(10) ** decimals << cursor) - uint256(10) ** decimals - liquidity;
    }

    function computeCurrentLiquidity(uint256 liquidity, uint256 decimals) internal pure returns (uint256) {
        uint256 cursor = computeCursor(liquidity, decimals);
        return liquidity - ((uint256(10) ** decimals << cursor) - uint256(10) ** decimals);
    }

    function computeCurrentComplement(uint256 liquidity, uint256 decimals) internal pure returns (uint256) {
        uint256 cursor = computeCursor(liquidity, decimals);
        return (uint256(10) ** decimals << (cursor + 1)) - uint256(10) ** decimals - liquidity;
    }

    function computeShardLiqidity(uint256 liquidity, uint256 decimals, uint256 cursor) internal pure returns (uint256) {
        if (cursor == computeCursor(liquidity, decimals)) {
            return computeCurrentLiquidity(liquidity, decimals);
        } else {
            return (uint256(10) ** decimals << cursor);
        }
    }
}
