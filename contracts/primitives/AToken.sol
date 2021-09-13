// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/IToken.sol";

import "@yield-protocol/utils-v2/contracts/token/ERC20Permit.sol";

import "../interfaces/IKernel.sol";
import "../libraries/helpers/Shell.sol";
import "../libraries/math/Cast.sol";

/// @title AToken
contract AToken is IToken, ERC20Permit {
    using Cast for uint256;
    using Shell for IKernel;

    /// @inheritdoc IToken
    IKernel public immutable override kernel;
    /// @inheritdoc IToken
    address public immutable override underlying;

    constructor(
        IKernel kernel_,
        address underlying_,
        string memory name,
        string memory symbol
    ) ERC20Permit(name, symbol, 18) {
        kernel = kernel_;
        underlying = underlying_;
    }

    /// @inheritdoc IToken
    function mint(address to) external override returns (uint256 amount) {
        amount = kernel.get(underlying, address(this)).x - _totalSupply.u128();
        if (amount > 0) require(_mint(to, amount), "MINT");
    }

    /// @inheritdoc IToken
    function burn(address to) external override returns (uint256 amount) {
        amount = _balanceOf[address(this)];
        if (amount > 0) {
            require(_burn(address(this), amount), "BURN");
            kernel.move(underlying, address(this), to, amount.u128(), 0);
        }
    }
}
