// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IEmulator00Functions {
    /// @notice Set a value.
    function set(bytes32 key, bytes memory data) external;

    /// @notice Sum votes before the votes are cast by the protocol.
    function sum(uint256 pid, bool support) external;

    /// @notice Trigger a protocol vote cast.
    function vote(uint256 pid, uint256 cursor) external;
}
