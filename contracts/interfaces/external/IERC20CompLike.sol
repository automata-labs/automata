// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20CompLike {
    function delegates(address) external view returns (address);
    function delegate(address delegatee) external;
    function getPriorVotes(address account, uint blockNumber) external view returns (uint96);
}
