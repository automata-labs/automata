// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../libraries/data/Stake.sol";

interface IAccumulatorStateDerived {
    /// @notice Returns the id of the next to be minted ERC721 token.
    function next() external view returns (uint256);
    
    /// @notice Returns a normalized user state.
    function get(uint256 id) external view returns (Stake.Data memory);
}
