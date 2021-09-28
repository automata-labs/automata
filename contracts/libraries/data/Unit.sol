// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../math/Cast.sol";
import "../math/Delta.sol";
import "../math/FixedPoint.sol";
import "../math/FullMath.sol";

library Unit {
    using Cast for uint256;
    using Delta for uint128;

    struct Data {
        uint128 x;
        uint128 y;
        uint256 x128;
    }

    function get(
        mapping(bytes32 => Unit.Data) storage self,
        address underlying,
        address owner
    ) internal view returns (Unit.Data storage) {
        return self[keccak256(abi.encode(underlying, owner))];
    }

    function normalize(
        Unit.Data memory self,
        uint256 x128
    ) internal pure returns (Unit.Data memory) {
        self.y += FullMath.mulDiv(self.x, x128 - self.x128, FixedPoint.Q128).u128();
        self.x128 = x128;

        return self;
    }

    function modify(
        Unit.Data storage self,
        int128 dx,
        int128 dy,
        uint256 x128
    ) internal {
        Unit.Data memory cache = self;

        cache.x = cache.x.addDelta(dx);
        cache.y += FullMath.mulDiv(self.x, x128 - self.x128, FixedPoint.Q128).u128();
        cache.y = cache.y.addDelta(dy);
        cache.x128 = x128;

        if (self.x != cache.x) self.x = cache.x;
        if (self.y != cache.y) self.y = cache.y;
        if (self.x128 != cache.x128) self.x128 = cache.x128;
    }
}
