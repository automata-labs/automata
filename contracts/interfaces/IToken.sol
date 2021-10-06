// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IKernel.sol";

interface IToken {
    /// @notice Returns the kernel contract.
    function kernel() external view returns (IKernel);

    /// @notice Returns the coin token address.
    function coin() external view returns (address);

    /// @notice Mint tokens.
    function mint(address to) external returns (uint256 amount);

    /// @notice Burn tokens.
    function burn(address to) external returns (uint256 amount);
}
