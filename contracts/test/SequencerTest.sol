// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@yield-protocol/utils-v2/contracts/token/IERC20.sol";
import "@yield-protocol/utils-v2/contracts/token/IERC20Metadata.sol";

import "../libraries/access/AccessControl.sol";
import "../libraries/helpers/TransferHelper.sol";

/// @dev An token contract that is constant to one. I.e. does not have shards.
///      This contract is used to test migration from the sharded sequencer to the constant sequencer.
contract SequencerTest is AccessControl {
    using TransferHelper for address;

    address public immutable coin;

    uint256 public liquidity;

    constructor(address coin_) {
        require(IERC20Metadata(coin_).decimals() == uint8(18), "18");
        coin = coin_;
    }

    function deposit() external auth returns (uint256 amount) {
        amount = IERC20(coin).balanceOf(address(this)) - liquidity;
        liquidity += amount;
    }

    function withdraw(address to, uint256 amount) external auth {
        coin.safeTransfer(to, amount);
        liquidity -= amount;
    }
}
