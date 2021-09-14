// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../ISequencer.sol";

interface IOperatorState {
    /// @notice Returns the sequencer.
    /// @dev The sequencer is manages the protocol owned tokens.
    function sequencer() external view returns (ISequencer);

    /// @notice Returns the external governor address.
    function governor() external view returns (address);

    /// @notice Returns the pauser implementation address.
    function observer() external view returns (address);

    /// @notice Returns a boolean on whether the `virtualize` functions is paused or not.
    function collapsed() external view returns (bool);

    /// @notice Returns a non-zero proposal id if governor is active.
    function pid() external view returns (uint256);
}
