// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../math/Cast.sol";
import "../math/FixedPoint.sol";
import "../math/FullMath.sol";

library State {
    using Cast for uint256;

    struct Data {
        uint128 x;
        uint128 y;
        uint256 x128;
    }

    function get(
        mapping(bytes32 => State.Data) storage self,
        address underlying,
        address owner
    ) internal view returns (State.Data storage) {
        return self[keccak256(abi.encode(underlying, owner))];
    }

    function normalize(State.Data memory state, uint256 x128) internal pure returns (State.Data memory) {
        state.y += FullMath.mulDiv(state.x, x128 - state.x128, FixedPoint.Q128).u128();
        state.x128 = x128;

        return state;
    }
}
