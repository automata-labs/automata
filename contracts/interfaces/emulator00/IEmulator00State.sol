// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../ISequencer.sol";
import "../../libraries/data/Slot.sol";

interface IEmulator00State {
    /// @notice Returns the sequencer.
    function sequencer() external view returns (ISequencer);

    /// @notice Returns external governor contract.
    function governor() external view returns (address);

    /// @notice Returns the period.
    /// @dev The period decides when `sum` and `vote` can be called.
    function period() external view returns (uint32);

    /// @notice The mapping from proposal id to past cursor and -votes.
    /// @dev The cursor and votes at the time the proposal was created. Uses the `priorVotes` function to determine it.
    function snapshots(uint256 pid) external view returns (uint256, uint256);

    /// @notice The mapping from proposal id to for- and against votes.
    function emulations(uint256 pid) external view returns (uint128 x, uint128 y);
}
