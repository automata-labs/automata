// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./Operator.sol";

import "../../interfaces/ISequencer.sol";
import "../../interfaces/external/IGovernorBravo.sol";
import "../../libraries/data/Checkpoint.sol";

/// @title OperatorB
contract OperatorB is Operator {
    constructor(address kernel_, address underlying_)
        Operator(kernel_, underlying_)
    {}

    /// @inheritdoc IOperatorFunctions
    function route(uint256 pid, uint256 cursor) external override {
        (,, uint256 start, uint256 end) = _timeline(pid);
        require(start > 0, "T0");
        require(block.number >= start, "BEG");
        require(block.number <= end, "END");

        Checkpoint.Data memory checkpoint = _checkpoint(pid, start);
        (uint8 support, uint256 amount) = _compute(checkpoint.votes, votes[pid].x, votes[pid].y);

        uint256 votesi = checkpoint.votes / (uint256(10) ** decimals);
        uint256 amounti = amount / (uint256(10) ** decimals);
    
        // bit field verification
        uint256 mask = 1 << cursor;
        if (amounti > (1 << checkpoint.cursor) - 1) {
            if (checkpoint.cursor != cursor) {
                uint256 head = votesi - ((1 << checkpoint.cursor) - 1);
                require((amounti - head) & mask == mask, "F0");
            }
        } else {
            require((amounti & mask) == mask, "F1");
        }

        // cast vote
        address[] memory targets  = new address[](1);
        bytes[] memory data = new bytes[](1);
        targets[0] = governor;
        data[0] = abi.encodeWithSelector(IGovernorBravo.castVote.selector, pid, support);

        ISequencer(sequencer).execute(cursor, targets, data);
    }

    function _observe() internal view override {
        uint256 count = IGovernorBravo(governor).proposalCount();
        try IGovernorBravo(governor).state(count) returns (uint256 state) {
            require(state > 1, "OBS");
        } catch {
            return;
        }
    }

    function _timeline(uint256 pid) internal view override returns (uint256, uint256, uint256, uint256) {
        (,,, uint256 start, uint256 end,,,,,) = IGovernorBravo(governor).proposals(pid);
        return (start, start + period - 1, start + period, end);
    }
}
