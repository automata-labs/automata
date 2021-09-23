// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/IShard.sol";

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import "../libraries/access/Access.sol";
import "../libraries/utils/RevertMsgExtractor.sol";

/// @title Shard
contract Shard is IShard, Access, Initializable {
    /// @inheritdoc IShardFunctions
    function initialize() external override initializer {
        _grantRole(Access(address(this)).ROOT(), msg.sender);
        emit Initialized();
    }

    /// @inheritdoc IShardFunctions
    function safeTransfer(
        address token,
        address to,
        uint256 amount
    ) external override auth {
        TransferHelper.safeTransfer(token, to, amount);
    }

    /// @inheritdoc IShardFunctions
    function execute(
        address[] calldata targets,
        bytes[] calldata data
    ) external override auth returns (bytes[] memory results) {
        require(targets.length == data.length, "Mismatched inputs");
        bytes32 txHash = keccak256(abi.encode(targets, data));

        results = new bytes[](targets.length);
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory result) = targets[i].call(data[i]);
            if (!success) revert(RevertMsgExtractor.getRevertMsg(result));
            results[i] = result;
        }

        emit Executed(txHash, targets, data);
    }
}
