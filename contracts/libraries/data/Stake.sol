// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../math/Cast.sol";
import "../math/Delta.sol";
import "../math/FixedPoint.sol";
import "../math/FullMath.sol";

library Stake {
    using Cast for uint256;
    using Delta for uint128;

    struct Data {
        uint96 nonce;
        address coin;
        uint128 x;
        uint128 y;
        uint256 x128;
    }

    function normalize(
        Stake.Data memory self,
        uint256 x128
    ) internal pure returns (Stake.Data memory _self) {
        _self = self;
        _self.y += FullMath.mulDiv(self.x, x128 - self.x128, FixedPoint.Q128).u128();
        _self.x128 = x128;
    }

    function modify(
        Stake.Data storage self,
        int128 dx,
        int128 dy,
        uint256 x128
    ) internal {
        Stake.Data memory cache = self;

        cache.x = cache.x.addDelta(dx);
        cache.y += FullMath.mulDiv(self.x, x128 - self.x128, FixedPoint.Q128).u128();
        cache.y = cache.y.addDelta(dy);
        cache.x128 = x128;

        if (self.x != cache.x) self.x = cache.x;
        if (self.y != cache.y) self.y = cache.y;
        if (self.x128 != cache.x128) self.x128 = cache.x128;
    }
}
