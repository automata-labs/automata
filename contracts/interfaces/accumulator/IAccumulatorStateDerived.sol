// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../libraries/data/Stake.sol";

interface IAccumulatorStateDerived {
    /// @notice Returns a normalized user state.
    function get(uint256 id) external view returns (Stake.Data memory);
}
