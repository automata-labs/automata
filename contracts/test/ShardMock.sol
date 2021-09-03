// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../interfaces/IShard.sol";

contract ShardMock {
    address public shard;
    address public executable;

    constructor(address _shard, address _executable) {
        shard = _shard;
        executable = _executable;
    }

    function functionWithoutArguments() external {
        address[] memory targets = new address[](1);
        targets[0] = executable;

        bytes[] memory data = new bytes[](1);
        data[0] = abi.encodeWithSignature("functionWithoutArguments()", "");

        IShard(shard).execute(targets, data);
    }

    function functionWithOneArgument() external {
        address[] memory targets = new address[](1);
        targets[0] = executable;

        bytes[] memory data = new bytes[](1);
        data[0] = abi.encodeWithSignature("functionWithOneArgument(uint256)", 42);

        IShard(shard).execute(targets, data);
    }

    function functionWithMultipleArugments() external {
        address[] memory targets = new address[](1);
        targets[0] = executable;

        bytes[] memory data = new bytes[](1);
        data[0] = abi.encodeWithSignature("functionWithMultipleArugments(uint256,address)", 42, msg.sender);

        IShard(shard).execute(targets, data);
    }

    function functionWithMultipleArugmentsAndResults() external {
        address[] memory targets = new address[](1);
        targets[0] = executable;

        bytes[] memory data = new bytes[](1);
        data[0] = abi.encodeWithSignature("functionWithMultipleArugmentsAndResults(uint256,address)", 42, msg.sender);

        bytes[] memory results = IShard(shard).execute(targets, data);
        (uint256 value0, address value1) = abi.decode(results[0], (uint256, address));
        require(value0 == 42, "Result not `42`.");
        require(value1 == msg.sender, "Result not `msg.sender`.");
    }
}

contract Executable {
    uint256 public value0;
    address public value1;

    function functionWithoutArguments() external {
        value0 = 1;
    }

    function functionWithOneArgument(uint256 argument0) external {
        value0 = argument0;
    }

    function functionWithMultipleArugments(uint256 argument0, address argument1) external {
        value0 = argument0;
        value1 = argument1;
    }

    function functionWithMultipleArugmentsAndResults(
        uint256 argument0,
        address argument1
    ) external returns (
        uint256,
        address
    ) {
        value0 = argument0;
        value1 = argument1;

        return (value0, value1);
    }
}