// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../IAccumulator.sol";

interface IEmulatorImmutables {
    /// @notice Returns the immutable accumulator.
    function accumulator() external view returns (IAccumulator);

    /// @notice Returns the immutable underlying token.
    function underlying() external view returns (address);

    /// @notice Returns the immutable token decimals.
    function decimals() external view returns (uint8);
}
