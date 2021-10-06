// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@uniswap/v3-core/contracts/libraries/BitMath.sol";

library Cursor {
    /// @notice Returns the cursor of the current liquidity.
    function getCursor(uint256 liquidity) internal pure returns (uint256) {
        uint256 number = liquidity / (uint256(10) ** uint256(18));
        if (number == 0) return 0;

        uint256 msb = BitMath.mostSignificantBit(number);
        // if sum of power of 2 and has decimals, then increment by 1
        // this solves the problem of being on the right cursor when withdrawing on decimal points
        if (number + 1 & number == 0) {
            return (liquidity - number * (uint256(10) ** uint256(18)) > 0) ? msb + 1 : msb;
        } else {
            return msb;
        }
    }

    /// @notice Returns the cursor of the current liquidity.
    /// @dev Rounds up if the liquidity is a sum of powers of two.
    ///      E.g. `1023` gives cursor `10` rather than `9`.
    function getCursorRoundingUp(uint256 liquidity) internal pure returns (uint256) {
        uint256 number = liquidity / (uint256(10) ** uint256(18));
        if (number == 0) return 0;

        uint256 msb = BitMath.mostSignificantBit(number);
        // if sum of power of 2 and has decimals, then increment by 1
        // this solves the problem of being on the right cursor when withdrawing on decimal points
        if (number + 1 & number == 0) {
            return (liquidity - number * (uint256(10) ** uint256(18)) >= 0) ? msb + 1 : msb;
        } else {
            return msb;
        }
    }
}
