// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../abstracts/Operator.sol";

import "../../interfaces/ISequencer.sol";
import "../../interfaces/external/IGovernorAlpha.sol";
import "../../libraries/data/Checkpoint.sol";

/// @title OperatorA
contract OperatorA is Operator {
    constructor(address coin_, address kernel_)
        Operator(coin_, kernel_)
    {}

    /// @inheritdoc IOperatorFunctions
    function use(uint256 pid, uint8 support) external override returns (uint128 amount) {
        (uint256 start, uint256 end,,) = _timeline(pid);
        require(start > 0, "T0");
        require(block.number >= start, "BEG");
        require(block.number <= end, "END");

        amount = IAccumulator(accumulator).grow(coin);
        require(amount > 0, "0");

        if (support == uint8(1)) {
            votes[pid].x += amount;
        } else if (support == uint8(0)) {
            votes[pid].y += amount;
        } else {
            revert("8");
        }

        emit Used(msg.sender, pid, support);
    }

    /// @inheritdoc IOperatorFunctions
    function route(uint256 pid, uint256 cursor) external override {
        (,, uint256 start, uint256 end) = _timeline(pid);
        require(start > 0, "T0");
        require(block.number >= start, "BEG");
        require(block.number <= end, "END");

        Checkpoint.Data memory checkpoint = _checkpoint(pid, start);

        uint256 max = checkpoint.votes / (uint256(10) ** uint256(18));
        uint256 x = votes[pid].x / (uint256(10) ** uint256(18));
        uint256 y = votes[pid].y / (uint256(10) ** uint256(18));
        (uint8 support_, uint256 amount) = _compute(max, x, y);
        bool support = (support_ == uint8(1)) ? true : false;

        // bit field verification
        uint256 mask = 1 << cursor;
        if (amount > (1 << checkpoint.cursor) - 1) {
            if (checkpoint.cursor != cursor) {
                uint256 head = max - ((1 << checkpoint.cursor) - 1);
                require((amount - head) & mask == mask, "F");
            }
        } else {
            require((amount & mask) == mask, "F");
        }

        // cast vote
        address[] memory targets  = new address[](1);
        bytes[] memory data = new bytes[](1);
        targets[0] = governor;
        data[0] = abi.encodeWithSelector(IGovernorAlpha.castVote.selector, pid, support);
        ISequencer(sequencer).execute(cursor, targets, data);

        emit Routed(msg.sender, pid, cursor);
    }

    function _observe() internal view override {
        if (governor != address(0)) {
            uint256 count = IGovernorAlpha(governor).proposalCount();
            if (count == 0) return;
            uint256 state = IGovernorAlpha(governor).state(count);
            require(state > 1, "OBS");
        }
    }

    function _timeline(uint256 pid) internal view override returns (uint256, uint256, uint256, uint256) {
        (,,, uint256 start, uint256 end,,,,) = IGovernorAlpha(governor).proposals(pid);
        return (start, end - period - 1, end - period, end);
    }

    function _checkpoint(uint256 pid, uint256 blockNumber) internal override returns (Checkpoint.Data memory) {
        if (checkpoints[pid].votes == 0) {
            uint256 checkpointedVotes;
            ISequencer _sequencer = ISequencer(sequencer);

            for (uint256 i = 0; i < _sequencer.cardinality(); i++) {
                uint256 priorVotes =
                    IERC20CompLike(coin).getPriorVotes(_sequencer.shards(i), blockNumber);
                uint256 capacity = (uint256(10) ** uint256(18) << i);

                if (priorVotes < capacity || i == _sequencer.cardinality() - 1) {
                    checkpointedVotes += priorVotes;
                    break;
                } else {
                    checkpointedVotes += priorVotes;
                }
            }

            checkpoints[pid].votes = checkpointedVotes;
            checkpoints[pid].cursor = Cursor.getCursorRoundingUp(checkpointedVotes);
        }

        return checkpoints[pid];
    }
}
