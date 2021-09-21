// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOperatorState {
    /// @notice Returns the accumulator.
    function accumulator() external view returns (address);

    /// @notice Returns the sequencer.
    /// @dev The sequencer is manages the protocol owned tokens.
    function sequencer() external view returns (address);

    /// @notice Returns the external governor address.
    function governor() external view returns (address);

    /// @notice Returns the period.
    /// @dev The period decides when `sum` and `vote` can be called.
    function period() external view returns (uint256);

    /// @notice Returns the voting strategy implementation.
    function computer() external view returns (address);

    /// @notice Returns the observe toggle.
    function observe() external view returns (bool);

    /// @notice The mapping from proposal id to past cursor and -votes.
    /// @dev The checkpoint is used for gas-savings when casting votes through the protocol. Instead
    ///      of having to call and tally up `getPriorVotes` each time, the values are cached by the
    ///      first cast vote call.
    function checkpoints(uint256 pid) external view returns (uint256 cursor, uint256 _votes);

    /// @notice The internal virtual votes state.
    /// @dev The virtual state is mapped to a realized voting values and does not represent the
    ///      final votes cast. Hence, the `Slot.Data` struct is being used instead of newly named
    ///      variables.
    function votes(uint256 pid) external view returns (uint128 x, uint128 y);
}
