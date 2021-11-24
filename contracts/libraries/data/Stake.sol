// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../external/Cast.sol";
import "../../external/Delta.sol";
import "../../external/FixedPoint.sol";
import "../../external/FullMath.sol";

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

    /// @notice Returns a state with up-to-date `y` and `x128` values.
    /// @param self The state.
    /// @param x128 The `x128` value of the pool.
    function normalize(
        Stake.Data memory self,
        uint256 x128
    ) internal pure returns (Stake.Data memory _self) {
        _self = self;
        _self.y += FullMath.mulDiv(self.x, x128 - self.x128, FixedPoint.Q128).u128();
        _self.x128 = x128;
    }

    /// @notice Sum deltas to the state.
    /// @param self The storage state.
    /// @param dx The `x` delta.
    /// @param dy The `y` delta.
    /// @param x128 The `x128` of the pool.
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
