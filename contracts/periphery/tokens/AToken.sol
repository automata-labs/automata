// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../interfaces/IToken.sol";

import "@yield-protocol/utils-v2/contracts/token/ERC20Permit.sol";

import "../../interfaces/IKernel.sol";
import "../../libraries/helpers/Shell.sol";
import "../../libraries/math/Cast.sol";

/// @title AToken
contract AToken is IToken, ERC20Permit {
    using Cast for uint256;
    using Shell for IKernel;

    /// @inheritdoc IToken
    IKernel public immutable kernel;
    /// @inheritdoc IToken
    address public immutable coin;

    constructor(
        IKernel kernel_,
        address coin_,
        string memory name,
        string memory symbol
    ) ERC20Permit(name, symbol, 18) {
        kernel = kernel_;
        coin = coin_;
    }

    /// @inheritdoc IToken
    function mint(address to) external returns (uint256 amount) {
        amount = kernel.get(coin, address(this)).x - _totalSupply.u128();
        require(amount > 0, "0");
        require(_mint(to, amount), "MINT");
    }

    /// @inheritdoc IToken
    function burn(address to) external returns (uint256 amount) {
        amount = _balanceOf[address(this)];
        require(amount > 0, "0");
        require(_burn(address(this), amount), "BURN");
        kernel.transfer(coin, address(this), to, amount.u128(), 0);
    }
}
