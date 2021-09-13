// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../data/State.sol";
import "../math/Delta.sol";

library Global {
    using Delta for uint128;

    function get(
        mapping(address => State.Data) storage self,
        address underlying
    ) internal view returns (State.Data storage) {
        return self[underlying];
    }

    function modify0(
        State.Data storage self,
        int128 dx,
        int128 dy,
        uint256 x128a
    ) internal {
        if (dx != 0) self.x = self.x.addDelta(dx);
        if (dy != 0) self.y = self.y.addDelta(dy);
        if (x128a > 0) self.x128 += x128a;
    }
}
