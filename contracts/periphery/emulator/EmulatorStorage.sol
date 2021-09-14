// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../libraries/data/Checkpoint.sol";
import "../../libraries/data/Slot.sol";

/// @title EmulatorStorage
contract EmulatorStorage {
    /// @notice Address eternal storage.
    mapping(bytes32 => address) public registry;
    /// @notice Integer eternal storage.
    mapping(bytes32 => uint256) public scalars;

    /// @notice Protocol votes- and cursor checkpoint save slots.
    /// @dev The checkpoint is used for gas-savings when casting votes through the protocol. Instead
    ///      of having to call and tally up `getPriorVotes` each time, the values are cached by the
    ///      first cast vote call.
    mapping(uint256 => Checkpoint.Data) public checkpoints;
    /// @notice The internal virtual votes state.
    /// @dev The virtual state is mapped to a realized voting values and does not represent the
    ///      final votes cast. Hence, the `Slot.Data` struct is being used instead of newly named
    ///      variables.
    mapping(uint256 => Slot.Data) public votes;
}
