// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/ISequencer.sol";

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@yield-protocol/utils-v2/contracts/token/IERC20.sol";
import "@yield-protocol/utils-v2/contracts/token/IERC20Metadata.sol";

import "./Shard.sol";
import "../interfaces/IShard.sol";
import "../interfaces/external/IERC20CompLike.sol";
import "../libraries/access/Access.sol";
import "../libraries/math/Cursor.sol";

/// @title Sequencer
contract Sequencer is ISequencer, Access {
    using TransferHelper for address;

    uint256 private constant MAX_CLONES = uint256(2) ** uint256(8);

    /// @inheritdoc ISequencerImmutables
    address public immutable underlying;
    /// @inheritdoc ISequencerImmutables
    uint256 public immutable decimals;
    /// @inheritdoc ISequencerImmutables
    address public immutable implementation;

    /// @inheritdoc ISequencerState
    address[] public shards;
    /// @inheritdoc ISequencerState
    mapping(address => uint256) public cursors;

    /// @inheritdoc ISequencerState
    uint256 public liquidity;

    constructor(address underlying_) {
        underlying = underlying_;
        decimals = IERC20Metadata(underlying_).decimals();
        implementation = address(new Shard());

        IShard(implementation).initialize();
    }

    /// @inheritdoc ISequencerStateDerived
    function cardinality() external view returns (uint256) {
        return _cardinality();
    }

    /// @inheritdoc ISequencerStateDerived
    function cardinalityMax() external pure returns (uint256) {
        return MAX_CLONES;
    }

    /// @inheritdoc ISequencerStateDerived
    function capacity() external view returns (uint256) {
        return _capacity();
    }

    /// @inheritdoc ISequencerStateDerived
    function compute(uint256 cursor) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, keccak256(abi.encodePacked(cursor)), address(this));
    }

    /// @inheritdoc ISequencerFunctions
    function clone() external returns (uint256, address) {
        require(_cardinality() + 1 <= MAX_CLONES, "MAX");
        return _clone();
    }

    /// @inheritdoc ISequencerFunctions
    function clones(uint256 amount) external returns (
        uint256[] memory cursored,
        address[] memory cloned
    ) {
        require(_cardinality() + amount <= MAX_CLONES, "MAX");

        cursored = new uint256[](amount);
        cloned = new address[](amount);
        for (uint256 i = 0; i < amount; i++) {
            (cursored[i], cloned[i]) = _clone();
        }
    }

    /// @inheritdoc ISequencerFunctions
    function deposit() external auth returns (uint256 balance) {
        balance = IERC20(underlying).balanceOf(address(this));
        require(balance > 0, "0");
        require(balance <= _capacity(), "OVF");

        liquidity += balance;

        uint256 amount = 0;
        while (amount != balance) {
            uint256 pivot = liquidity - balance + amount;
            uint256 cursor = Cursor.getCursorRoundingUp(pivot, decimals);

            address shard = shards[cursor];
            require(shard != address(0), "ADDRZ");

            uint256 complement = (uint256(10) ** decimals << (cursor + 1)) - (uint256(10) ** decimals) - pivot;
            if (balance - amount > complement) {
                underlying.safeTransfer(shard, complement);
                amount += complement;
            } else {
                underlying.safeTransfer(shard, balance - amount);
                amount = balance;
            }
        }

        emit Sequenced(msg.sender, liquidity);
    }

    /// @inheritdoc ISequencerFunctions
    function withdraw(address to, uint256 target) external auth {
        require(target > 0, "0");
        require(target <= liquidity, "UVF");

        liquidity -= target;

        uint256 amount = 0;
        while (amount != target) {
            uint256 pivot = liquidity + target - amount;
            uint256 cursor = Cursor.getCursor(pivot, decimals);

            address shard = shards[cursor];
            require(shard != address(0), "ADDRZ");

            uint256 excess = pivot - ((uint256(10) ** decimals << cursor) - uint256(10) ** decimals);
            if (target - amount > excess) {
                IShard(shard).transfer(underlying, to, excess);
                amount += excess;
            } else {
                IShard(shard).transfer(underlying, to, target - amount);
                amount = target;
            }
        }

        emit Withdrawn(msg.sender, liquidity);
    }

    /// @inheritdoc ISequencerFunctions
    function execute(uint256 cursor, address[] calldata targets, bytes[] calldata data)
        external
        auth
        returns (bytes[] memory)
    {
        return IShard(shards[cursor]).execute(targets, data);
    }

    function _cardinality() internal view returns (uint256) {
        return shards.length;
    }

    function _capacity() internal view returns (uint256) {
        return (uint256(10) ** decimals << _cardinality()) - uint256(10) ** decimals - liquidity;
    }

    function _clone() internal returns (uint256 cursor, address cloned) {
        cursor = _cardinality();
        cloned = Clones.cloneDeterministic(implementation, keccak256(abi.encodePacked(cursor)));

        // send value 1 of underlying to shard to initialize storage slot, saving gas
        // shard not initializing with 0 tokens does not affect the logic
        underlying.safeTransferFrom(msg.sender, cloned, 1);

        // delegate to self after cloning shard.
        // will fail if `underlying` is not a `CompLike` token.
        IShard(cloned).initialize();
        IShard(cloned).delegate(underlying, cloned);

        // update
        cursors[cloned] = cursor;
        shards.push(cloned);

        emit Cloned(msg.sender, cursor, cloned);
    }
}
