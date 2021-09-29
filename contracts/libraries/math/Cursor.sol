// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@uniswap/v3-core/contracts/libraries/BitMath.sol";

library Cursor {
    /// @notice Returns the cursor of the current liquidity.
    function getCursor(uint256 liquidity, uint256 decimals) internal pure returns (uint256) {
        uint256 value = liquidity / (uint256(10) ** decimals);
        if (value == 0) {
            return 0;
        } else {
            return BitMath.mostSignificantBit(value);
        }
    }

    /// @notice Returns the cursor of the current liquidity.
    /// @dev Rounds up if the liquidity is a sum of powers of two.
    ///      E.g. `1023` gives cursor `10` rather than `9`.
    function getCursorRoundingUp(uint256 liquidity, uint256 decimals) internal pure returns (uint256) {
        uint256 value = liquidity / (uint256(10) ** decimals);
        if (value == 0) {
            return 0;
        } else {
            uint256 mostSignificantBit = BitMath.mostSignificantBit(value);
            return (((value + 1) & value) == 0) ? mostSignificantBit + 1 : mostSignificantBit;
        }
    }

    /// @notice Returns the total capacity left.
    function getCapacity(uint256 liquidity, uint256 decimals, uint256 cursor) internal pure returns (uint256) {
        return (uint256(10) ** decimals << cursor) - uint256(10) ** decimals - liquidity;
    }

    /// @notice Returns the capacity of the current shard.
    function getCapacityInContext(uint256 liquidity, uint256 decimals) internal pure returns (uint256) {
        uint256 cursor = getCursorRoundingUp(liquidity, decimals);
        return (uint256(10) ** decimals << (cursor + 1)) - uint256(10) ** decimals - liquidity;
    }

    /// @notice Returns the liquidity of the current shard.
    function getLiquidityInContext(uint256 liquidity, uint256 decimals) internal pure returns (uint256) {
        uint256 cursor = getCursorRoundingUp(liquidity, decimals);
        return liquidity - ((uint256(10) ** decimals << cursor) - uint256(10) ** decimals);
    }

    /// @notice Returns the liquidity of any shard, given a cursor.
    function getLiquidityInShard(uint256 liquidity, uint256 decimals, uint256 cursor) internal pure returns (uint256) {
        if (cursor == getCursorRoundingUp(liquidity, decimals)) {
            return getLiquidityInContext(liquidity, decimals);
        } else {
            return (uint256(10) ** decimals << cursor);
        }
    }
}
