// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@yield-protocol/utils-v2/contracts/token/ERC20Permit.sol";

contract ERC20Mock is ERC20Permit {
    constructor(string memory name, string memory symbol) ERC20Permit(name, symbol, 18) {}

    function mint(address to, uint256 amount) public virtual {
        _mint(to, amount);
    }
}
