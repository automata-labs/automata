// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IDelegatee {
    function onDelegateLoan(
        address initiator,
        address underlying,
        uint256 cursor,
        address delegatee,
        bytes calldata data
    ) external returns (bytes32);

    function onDelegateLoans(
        address initiator,
        address underlying,
        uint256[] calldata cursors,
        address[] calldata delegatees,
        bytes calldata data
    ) external returns (bytes32);
}
