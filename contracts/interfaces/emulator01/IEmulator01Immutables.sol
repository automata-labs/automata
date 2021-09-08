// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../IAccumulator.sol";

interface IEmulator01Immutables {
    /// @notice Returns the accumulator.
    function accumulator() external view returns (IAccumulator);

    /// @notice Returns the underlying token.
    /// @dev The underlying also decides which asset this emulator supports.
    ///      Each asset needs its own emulator.
    function underlying() external view returns (address);

    /// @notice Returns the underlying's decimals.
    function decimals() external view returns (uint8);
}
