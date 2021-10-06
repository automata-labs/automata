// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../abstracts/Operator.sol";

contract OperatorMock is Operator {
    constructor(address kernel_, address coin_)
        Operator(kernel_, coin_)
    {}

    function use(uint256 pid, uint8 support) external override {}

    function route(uint256 pid, uint256 cursor) external override {}

    function _observe() internal view override {}

    function _timeline(uint256 pid) internal view override returns (uint256, uint256, uint256, uint256) {}
}
