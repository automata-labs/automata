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
}
