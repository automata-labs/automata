// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../libraries/math/Cursor.sol";

contract FuzzCursor {
    event AssertionFailed();

    function getCursorInvariant(uint256 input) public {
        uint256 cursor = Cursor.getCursor(input);
        if ((1 << cursor + 2) - 1 <= input / 10 ** 18) emit AssertionFailed();
        if ((1 << cursor) - 1 > input / 10 ** 18) emit AssertionFailed();
    }

    function getCursorRoundingUpInvariant(uint256 input) public {
        uint256 cursor = Cursor.getCursorRoundingUp(input);
        if ((1 << cursor + 1) - 1 <= input / 10 ** 18) emit AssertionFailed();
        if ((1 << cursor) - 1 > input / 10 ** 18) emit AssertionFailed();
    }
}
