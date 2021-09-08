// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../ISequencer.sol";

interface IOperatorState {
    /// @notice Returns the sequencer.
    /// @dev The sequencer is manages the protocol owned tokens.
    function sequencer() external view returns (ISequencer);

    /// @notice Returns the external governor address.
    function governor() external view returns (address);

    /// @notice Returns the frozen state of the operator.
    /// @dev If the operator is frozen, the `virtualize` function is disabled.
    function frozen() external view returns (uint256, bool);
}
