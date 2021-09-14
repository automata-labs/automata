// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../interfaces/IROM.sol";

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../interfaces/IAccumulator.sol";
import "../../interfaces/ISequencer.sol";
import "../../interfaces/external/IERC20CompLike.sol";
import "../../interfaces/external/IGovernorAlpha.sol";
import "../../libraries/access/Access.sol";
import "../../libraries/data/Checkpoint.sol";
import "../../libraries/proxy/ERC1967Implementation.sol";

/// @notice ROMAlpha
contract ROMAlpha is IROM, ERC1967Implementation, Initializable, Access {
    /// @inheritdoc IEmulatorImmutables
    function accumulator() external pure override returns (IAccumulator) { revert("IMMUTABLE"); }
    /// @inheritdoc IEmulatorImmutables
    function underlying() external pure override returns (address) { revert("IMMUTABLE"); }
    /// @inheritdoc IEmulatorImmutables
    function decimals() external pure override returns (uint8) { revert("IMMUTABLE"); }

    /// @inheritdoc IROMState
    ISequencer public override sequencer;
    /// @inheritdoc IROMState
    address public override governor;
    /// @inheritdoc IROMState
    uint32 public override period;
    /// @inheritdoc IROMState
    mapping(uint256 => Checkpoint.Data) public override checkpoints;
    /// @inheritdoc IROMState
    mapping(uint256 => Slot.Data) public override votes;

    /// @inheritdoc IROMStateDerived
    function summingPeriod(uint256 pid) external view override returns (uint256, uint256) {
        (uint256 startBlock, ) = _startAndEndBlock(pid);
        return (startBlock, startBlock + period - 1);
    }

    /// @inheritdoc IROMStateDerived
    function votingPeriod(uint256 pid) external view override returns (uint256, uint256) {
        (uint256 startBlock, uint256 endBlock) = _startAndEndBlock(pid);
        return (startBlock + period, endBlock);
    }

    /// @inheritdoc IROMFunctions
    function initialize() external override initializer {
        _grantRole(Access.ROOT, msg.sender);
    }

    function set(bytes4 selector, bytes memory data) external auth {
        if (selector == IROMState.sequencer.selector) sequencer = abi.decode(data, (ISequencer));
        else if (selector == IROMState.governor.selector) governor = abi.decode(data, (address));
        else if (selector == IROMState.period.selector) period = abi.decode(data, (uint32));
        else revert("!");
    }

    /// @inheritdoc IROMFunctions
    function sum(uint256 pid, bool support) external override {
        uint128 amount = this.accumulator().grow(this.underlying());
        require(amount > 0, "0");

        (uint256 startBlock, ) = _startAndEndBlock(pid);
        require(startBlock > 0, "E");
        require(block.number >= startBlock, "EARLY");
        require(block.number < startBlock + period, "ENDED");

        if (support) {
            votes[pid].x += amount;
        } else {
            votes[pid].y += amount;
        }
    }

    /// @inheritdoc IROMFunctions
    function vote(uint256 pid, uint256 cursor) external override {
        (uint256 startBlock, uint256 endBlock) = _startAndEndBlock(pid);
        require(startBlock > 0, "E");
        require(block.number >= startBlock + period, "EARLY");
        require(block.number <= endBlock, "ENDED");

        Checkpoint.Data memory checkpoint = _loadCheckpoint(pid, startBlock);

        uint256 delta;
        bool support;
        // computes integer delta and bool for support
        // at most `10 ** decimals` imprecision
        if (votes[pid].x > votes[pid].y) {
            // caps at max available prior votes
            delta = Math.min(
                checkpoint.votes,
                (votes[pid].x - votes[pid].y) / (uint256(10) ** uint256(this.decimals()))
            );
            support = true;
        } else if (votes[pid].x < votes[pid].y) {
            // caps at max available prior votes
            delta = Math.min(
                checkpoint.votes,
                (votes[pid].y - votes[pid].x) / (uint256(10) ** uint256(this.decimals()))
            );
            support = false;
        } else {
            return;
        }

        // bit field verification
        uint256 mask = 1 << cursor;
        if (delta > (1 << checkpoint.cursor) - 1) {
            if (checkpoint.cursor != cursor) {
                uint256 head = checkpoint.votes - ((1 << checkpoint.cursor) - 1);
                require((delta - head) & mask == mask, "F0");
            }
        } else {
            require((delta & mask) == mask, "F1");
        }

        // cast vote
        address[] memory targets  = new address[](1);
        bytes[] memory data = new bytes[](1);
        targets[0] = governor;
        data[0] = abi.encodeWithSignature("castVote(uint256,bool)", pid, support);

        this.sequencer().execute(cursor, targets, data);
    }

    function _startAndEndBlock(uint256 pid) internal view returns (uint256 startBlock, uint256 endBlock) {
        (,,, startBlock, endBlock,,,,) = IGovernorAlpha(governor).proposals(pid);
    }

    function _loadCheckpoint(uint256 pid, uint256 blockNumber) internal returns (Checkpoint.Data memory) {
        if (checkpoints[pid].votes == 0) {
            uint256 checkpointedCursor;
            uint256 checkpointedVotes;

            for (uint256 i = 0; i < sequencer.cardinality(); i++) {
                uint256 priorVotes =
                    IERC20CompLike(this.underlying()).getPriorVotes(sequencer.shards(i), blockNumber);
                uint256 capacity = (uint256(10) ** uint256(this.decimals()) << i);

                checkpointedVotes += priorVotes / (uint256(10) ** uint256(this.decimals()));

                if (priorVotes < capacity || i == sequencer.cardinality() - 1) {
                    checkpointedCursor = i;
                    break;
                }
            }

            checkpoints[pid].cursor = checkpointedCursor;
            checkpoints[pid].votes = checkpointedVotes;
        }

        return checkpoints[pid];
    }

    function _authorizeUpgrade(address) internal override auth {}
}
