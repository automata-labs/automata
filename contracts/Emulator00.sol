// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IEmulator00.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@yield-protocol/utils-v2/contracts/token/IERC20Metadata.sol";

import "./interfaces/external/ICompLike.sol";
import "./interfaces/external/IGovernorAlpha.sol";
import "./interfaces/IAccumulator.sol";
import "./interfaces/ISequencer.sol";
import "./libraries/access/Access.sol";
import "./libraries/data/Slot.sol";
import "./libraries/utils/Lock.sol";

/// @title Emulator00
/// @dev The Emulator00 only supports GovernorAlpha.
contract Emulator00 is IEmulator00, Access, Lock {
    /// @inheritdoc IEmulator00Immutables
    IAccumulator public immutable override accumulator;
    /// @inheritdoc IEmulator00Immutables
    address public immutable override underlying;
    /// @inheritdoc IEmulator00Immutables
    uint8 public immutable override decimals;

    /// @inheritdoc IEmulator00State
    ISequencer public override sequencer;
    /// @inheritdoc IEmulator00State
    address public override governor;
    /// @inheritdoc IEmulator00State
    uint32 public override period;

    struct Snapshot {
        uint256 cursor;
        uint256 votes;
    }
    /// @inheritdoc IEmulator00State
    mapping(uint256 => Snapshot) public override snapshots;
    /// @inheritdoc IEmulator00State
    mapping(uint256 => Slot.Data) public override emulations;

    constructor(IAccumulator accumulator_, address underlying_) {
        accumulator = accumulator_;
        underlying = underlying_;
        decimals = IERC20Metadata(underlying_).decimals();
    }

    /// @inheritdoc IEmulator00DerivedState
    function phase0(uint256 pid) external view override returns (uint256, uint256) {
        (uint256 startBlock, ) = _duration(pid);
        return (startBlock, startBlock + period - 1);
    }

    /// @inheritdoc IEmulator00DerivedState
    function phase1(uint256 pid) external view override returns (uint256, uint256) {
        (uint256 startBlock, uint256 endBlock) = _duration(pid);
        return (startBlock + period, endBlock);
    }

    /// @inheritdoc IEmulator00Functions
    function set(bytes32 key, bytes memory data) external override auth {
        if (key == "sequencer") sequencer = abi.decode(data, (ISequencer));
        else if (key == "governor") governor = abi.decode(data, (address));
        else if (key == "period") period = abi.decode(data, (uint32));
        else revert("!");        
    }

    /// @inheritdoc IEmulator00Functions
    function sum(uint256 pid, bool support) external override lock {
        uint128 amount = accumulator.grow(underlying);
        require(amount > 0, "0");

        (uint256 startBlock, ) = _duration(pid);
        require(startBlock > 0, "E");
        require(block.number >= startBlock, "EARLY");
        require(block.number < startBlock + period, "ENDED");

        if (support) {
            emulations[pid].x += amount;
        } else {
            emulations[pid].y += amount;
        }
    }

    /// @inheritdoc IEmulator00Functions
    function vote(uint256 pid, uint256 cursor) external override lock {
        (uint256 startBlock, uint256 endBlock) = _duration(pid);
        require(startBlock > 0, "E");
        require(block.number >= startBlock + period, "EARLY");
        require(block.number <= endBlock, "ENDED");

        Snapshot memory snapshot = _load(pid, startBlock);
        uint256 delta;
        bool support;

        // computes integer delta and bool for support
        // at most `10 ** decimals` imprecision
        if (emulations[pid].x > emulations[pid].y) {
            // caps at max available prior votes
            delta = Math.min(snapshot.votes, (emulations[pid].x - emulations[pid].y) / (uint256(10) ** decimals));
            support = true;
        } else if (emulations[pid].x < emulations[pid].y) {
            // caps at max available prior votes
            delta = Math.min(snapshot.votes, (emulations[pid].y - emulations[pid].x) / (uint256(10) ** decimals));
            support = false;
        } else {
            return;
        }

        // bit field verification
        uint256 mask = 1 << cursor;
        if (delta > (1 << snapshot.cursor) - 1) {
            if (snapshot.cursor != cursor) {
                uint256 head = snapshot.votes - ((1 << snapshot.cursor) - 1);
                require((delta - head) & mask == mask, "M0");
            }
        } else {
            require((delta & mask) == mask, "M1");
        }

        // cast vote
        address[] memory targets  = new address[](1);
        bytes[] memory data = new bytes[](1);
        targets[0] = governor;
        data[0] = abi.encodeWithSignature("castVote(uint256,bool)", pid, support);
        sequencer.execute(cursor, targets, data);
    }

    function _duration(uint256 pid) internal view returns (uint256 startBlock, uint256 endBlock) {
        (,,, startBlock, endBlock,,,,) = IGovernorAlpha(governor).proposals(pid);
    }

    function _load(uint256 pid, uint256 blockNumber) internal returns (Snapshot memory) {
        if (snapshots[pid].votes == 0) {
            uint256 pastCursor;
            uint256 pastVotes;

            for (uint256 i = 0; i < sequencer.cardinality(); i++) {
                uint256 priorVotes = ICompLike(underlying).getPriorVotes(sequencer.shards(i), blockNumber);
                uint256 capacity = (uint256(10) ** decimals << i);

                pastVotes += priorVotes / (uint256(10) ** decimals);

                if (priorVotes < capacity || i == sequencer.cardinality() - 1) {
                    pastCursor = i;
                    break;
                }
            }

            snapshots[pid].cursor = pastCursor;
            snapshots[pid].votes = pastVotes;
        }

        return snapshots[pid];
    }
}
