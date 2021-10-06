// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/IShard.sol";

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "../interfaces/external/IERC20CompLike.sol";
import "../libraries/access/Access.sol";
import "../libraries/helpers/TransferHelper.sol";
import "../libraries/utils/RevertMsgExtractor.sol";

/// @title Shard
contract Shard is IShard, Access, Initializable {
    using TransferHelper for address;

    /// @inheritdoc IShardFunctions
    function initialize() external initializer {
        _grantRole(Access(address(this)).ROOT(), msg.sender);
        emit Initialized();
    }

    /// @inheritdoc IShardFunctions
    function transfer(address token, address to, uint256 amount) external auth {
        token.safeTransfer(to, amount);
    }

    /// @inheritdoc IShardFunctions
    function delegate(address token, address delegatee) external auth {
        IERC20CompLike(token).delegate(delegatee);
    }

    /// @inheritdoc IShardFunctions
    function execute(
        address[] calldata targets,
        bytes[] calldata data
    ) external auth returns (bytes[] memory results) {
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
