// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@yield-protocol/utils-v2/contracts/token/ERC20Permit.sol";

import "../interfaces/IKernel.sol";
import "../libraries/math/Cast.sol";
import "../libraries/utils/Shell.sol";

contract AToken is ERC20Permit {
    using Cast for uint256;
    using Shell for IKernel;

    IKernel public immutable kernel;
    address public immutable underlying;

    constructor(
        IKernel kernel_,
        address underlying_,
        string memory name,
        string memory symbol
    ) ERC20Permit(name, symbol, 18) {
        kernel = kernel_;
        underlying = underlying_;
    }

    function mint(address to) external returns (uint256 amount) {
        amount = kernel.fetch(underlying, address(this)).x - _totalSupply.u128();
        if (amount > 0) require(_mint(to, amount), "MINT");
    }

    function burn(address to) external returns (uint256 amount) {
        amount = _balanceOf[address(this)];
        if (amount > 0) {
            require(_burn(address(this), amount), "BURN");
            kernel.move(underlying, address(this), to, amount.u128(), 0);
        }
    }
}
