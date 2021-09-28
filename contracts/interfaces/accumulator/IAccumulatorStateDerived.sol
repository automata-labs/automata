// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../libraries/data/Unit.sol";

interface IAccumulatorStateDerived {
    /// @notice Returns a normalized state.
    function get(address underlying, address owner) external view returns (Unit.Data memory);
}
