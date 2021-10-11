// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../abstracts/Operator.sol";

contract OperatorMock is Operator {
    constructor(address coin_, address kernel_)
        Operator(coin_, kernel_)
    {}

    function use(uint256 pid, uint8 support) external override returns (uint128 amount) {}

    function route(uint256 pid, uint256 cursor) external override {}

    function _observe() internal view override {}

    function _timeline(uint256 pid) internal view override returns (uint256, uint256, uint256, uint256) {}

    function _checkpoint(uint256 pid, uint256 blockNumber) internal override returns (Checkpoint.Data memory) {}
}
