// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../libraries/math/Cursor.sol";

contract CursorMock {
    function getCursor(uint256 liquidity, uint256 decimals) external pure returns (uint256) {
        return Cursor.getCursor(liquidity, decimals);
    }

    function getCursorRoundingUp(uint256 liquidity, uint256 decimals) external pure returns (uint256) {
        return Cursor.getCursorRoundingUp(liquidity, decimals);
    }
}
