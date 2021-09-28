// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../math/Delta.sol";

library Glob {
    using Delta for uint128;

    struct Data {
        uint128 x;
        uint128 y;
        uint256 x128;
    }

    function get(
        mapping(address => Glob.Data) storage self,
        address underlying
    ) internal view returns (Glob.Data storage) {
        return self[underlying];
    }

    function modify(
        Glob.Data storage self,
        int128 dx,
        int128 dy,
        uint256 x128a
    ) internal {
        if (dx != 0) self.x = self.x.addDelta(dx);
        if (dy != 0) self.y = self.y.addDelta(dy);
        if (x128a > 0) self.x128 += x128a;
    }
}
