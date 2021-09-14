// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@yield-protocol/utils-v2/contracts/token/IERC20Metadata.sol";

import "./EmulatorStorage.sol";
import "../../interfaces/IAccumulator.sol";
import "../../interfaces/ISequencer.sol";
import "../../interfaces/external/IERC20CompLike.sol";
import "../../interfaces/external/IGovernorBravo.sol";
import "../../libraries/access/Access.sol";
import "../../libraries/data/Checkpoint.sol";

/// @notice EmulationBravo
contract EmulationBravo is EmulatorStorage, UUPSUpgradeable, Initializable, Access {
    function initialize() external initializer {
        _grantRole(Access.ROOT, msg.sender);
    }

    function summingPeriod(uint256 pid) external view returns (uint256, uint256) {
        (uint256 startBlock, ) = _startAndEndBlock(pid);
        return (startBlock, startBlock + scalars["period"] - 1);
    }

    function votingPeriod(uint256 pid) external view returns (uint256, uint256) {
        (uint256 startBlock, uint256 endBlock) = _startAndEndBlock(pid);
        return (startBlock + scalars["period"], endBlock);
    }

    function register(bytes32 key, address value) external auth {
        registry[key] = value;
    }

    function scale(bytes32 key, uint256 value) external auth {
        scalars[key] = value;
    }

    function sum(uint256 pid, bool support) external {
        uint128 amount = IAccumulator(registry["accumulator"]).grow(registry["underlying"]);
        require(amount > 0, "0");

        (uint256 startBlock, ) = _startAndEndBlock(pid);
        require(startBlock > 0, "E");
        require(block.number >= startBlock, "EARLY");
        require(block.number < startBlock + scalars["period"], "ENDED");

        if (support) {
            votes[pid].x += amount;
        } else {
            votes[pid].y += amount;
        }
    }

    function vote(uint256 pid, uint256 cursor) external {
        (uint256 startBlock, uint256 endBlock) = _startAndEndBlock(pid);
        require(startBlock > 0, "E");
        require(block.number >= startBlock + scalars["period"], "EARLY");
        require(block.number <= endBlock, "ENDED");

        Checkpoint.Data memory checkpoint = _loadCheckpoint(pid, startBlock);

        uint256 delta;
        uint8 support;
        // computes integer delta and uint8 for support
        // at most `10 ** decimals` imprecision
        if (votes[pid].x > votes[pid].y) {
            // caps at max available prior votes
            delta = Math.min(checkpoint.votes, (votes[pid].x - votes[pid].y) / (uint256(10) ** scalars["decimals"]));
            support = uint8(1);
        } else if (votes[pid].x < votes[pid].y) {
            // caps at max available prior votes
            delta = Math.min(checkpoint.votes, (votes[pid].y - votes[pid].x) / (uint256(10) ** scalars["decimals"]));
            support = uint8(0);
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
        targets[0] = registry["governor"];
        data[0] = abi.encodeWithSignature("castVote(uint256,uint8)", pid, support);

        ISequencer(registry["sequencer"]).execute(cursor, targets, data);
    }

    function _startAndEndBlock(uint256 pid) internal view returns (uint256 startBlock, uint256 endBlock) {
        (,,, startBlock, endBlock,,,,,) = IGovernorBravo(registry["governor"]).proposals(pid);
    }

    function _loadCheckpoint(uint256 pid, uint256 blockNumber) internal returns (Checkpoint.Data memory) {
        if (checkpoints[pid].votes == 0) {
            uint256 checkpointedCursor;
            uint256 checkpointedVotes;

            ISequencer sequencer = ISequencer(registry["sequencer"]);
            IERC20CompLike underlying = IERC20CompLike(registry["underlying"]);
            uint256 decimals = scalars["decimals"];

            for (uint256 i = 0; i < sequencer.cardinality(); i++) {
                uint256 priorVotes = underlying.getPriorVotes(sequencer.shards(i), blockNumber);
                uint256 capacity = (uint256(10) ** decimals << i);

                checkpointedVotes += priorVotes / (uint256(10) ** decimals);

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
