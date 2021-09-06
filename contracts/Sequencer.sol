// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/ISequencer.sol";
import "./interfaces/ISequencerEvents.sol";

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@yield-protocol/utils-v2/contracts/token/IERC20Metadata.sol";

import "./Shard.sol";
import "./interfaces/ISequencerFactory.sol";
import "./interfaces/IShard.sol";
import "./libraries/access/Access.sol";
import "./libraries/math/Cursor.sol";

/// @title Sequencer
contract Sequencer is ISequencer, ISequencerEvents, Access {
    uint256 private constant MAX_CLONES = uint256(2) ** uint256(8);

    /// @inheritdoc ISequencer
    address public immutable override underlying;
    /// @inheritdoc ISequencer
    uint256 public immutable override decimals;
    /// @inheritdoc ISequencer
    address public immutable override implementation;

    /// @inheritdoc ISequencer
    address[] public override shards;
    /// @inheritdoc ISequencer
    mapping(address => uint256) public override cursors;

    /// @inheritdoc ISequencer
    uint256 public override liquidity;

    constructor() {
        address underlying_ = ISequencerFactory(msg.sender).parameters();
        address implementation_ = address(new Shard());

        decimals = IERC20Metadata(underlying_).decimals();
        IShard(implementation_).initialize();

        underlying = underlying_;
        implementation = implementation_;
    }

    /// @inheritdoc ISequencer
    function cardinality() external view override returns (uint256) {
        return _cardinality();
    }

    /// @inheritdoc ISequencer
    function cardinalityMax() external pure override returns (uint256) {
        return MAX_CLONES;
    }

    /// @inheritdoc ISequencer
    function compute(uint256 cursor) external view override returns (address) {
        return Clones.predictDeterministicAddress(implementation, keccak256(abi.encodePacked(cursor)), address(this));
    }

    /// @inheritdoc ISequencer
    function clone() external override returns (uint256, address) {
        require(_cardinality() + 1 <= MAX_CLONES, "MAX");
        return _clone();
    }

    /// @inheritdoc ISequencer
    function clones(uint256 amount) external override returns (
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

    /// @inheritdoc ISequencer
    function deposit() external override auth returns (uint256 amount) {
        amount = IERC20(underlying).balanceOf(address(this));
        if (amount == 0) {
            return 0;
        } else {
            require(amount <= Cursor.getCapacity(liquidity, decimals, _cardinality()), "SOVF");
        }

        uint256 stack = amount;
        uint256 liquidityNext = liquidity;
        uint256 cursor = Cursor.getCursor(liquidity, decimals);
        while (stack != 0) {
            address shard = shards[cursor];
            require(shard != address(0), "ADRZ");

            uint256 complement = Cursor.getCapacityInContext(liquidityNext, decimals);
            if (complement != 0) {
                TransferHelper.safeTransfer(underlying, shard, Math.min(stack, complement));
                liquidityNext += Math.min(stack, complement);
                stack -= Math.min(stack, complement);
            }

            cursor += 1;
        }
        require(IERC20(underlying).balanceOf(address(this)) == 0, "!Z");

        liquidity = liquidityNext;

        emit Sequenced(liquidity);
    }

    /// @inheritdoc ISequencer
    function withdraw(address to, uint256 amount) external override auth returns (uint256 withdrawn) {
        if (amount == 0) {
            return 0;
        } else {
            require(amount <= liquidity, "WOVF");
        }

        uint256 stack = amount;
        uint256 liquidityNext = liquidity;
        uint256 cursor = Cursor.getCursor(liquidityNext, decimals);
        while (stack > 0) {
            address shard = shards[cursor];
            require(shard != address(0), "ADRZ");

            address[] memory targets  = new address[](1);
            bytes[] memory data = new bytes[](1);
            uint256 balance = Cursor.getLiquidityInShard(liquidityNext, decimals, cursor);
            if (balance != 0) {
                if (stack > balance) {
                    targets[0] = underlying;
                    data[0] = abi.encodeWithSignature("transfer(address,uint256)", to, balance);

                    IShard(shard).execute(targets, data);
                    liquidityNext -= balance;
                    stack -= balance;
                } else {
                    targets[0] = underlying;
                    data[0] = abi.encodeWithSignature("transfer(address,uint256)", to, stack);

                    IShard(shard).execute(targets, data);
                    liquidityNext -= stack;
                    stack = 0;
                }
            }

            cursor -= (cursor > 0) ? 1 : 0;
        }
        require(stack == 0, "!Z");

        withdrawn = amount;
        liquidity = liquidityNext;

        emit Withdrawn(liquidity);
    }

    /// @inheritdoc ISequencer
    function execute(
        uint256 cursor,
        address[] calldata targets,
        bytes[] calldata data
    ) external override auth returns (bytes[] memory) {
        return IShard(shards[cursor]).execute(targets, data);
    }

    function _cardinality() internal view returns (uint256) {
        return shards.length;
    }

    function _clone() internal returns (uint256 cursor, address cloned) {
        cursor = _cardinality();
        cloned = Clones.cloneDeterministic(implementation, keccak256(abi.encodePacked(cursor)));
        // send value 1 of underlying to shard to save gas costs
        // shard not initializing with 0 tokens does not affect the logic
        address[] memory targets = new address[](1);
        bytes[] memory data = new bytes[](1);

        // delegate to self after cloning shard.
        // will fail if `underlying` is not a `CompLike` token.
        targets[0] = underlying;
        data[0] = abi.encodeWithSignature("delegate(address)", cloned);

        TransferHelper.safeTransferFrom(underlying, msg.sender, cloned, 1);
        IShard(cloned).initialize();
        IShard(cloned).execute(targets, data);

        // update
        cursors[cloned] = cursor;
        shards.push(cloned);

        emit Cloned(cursor, cloned);
    }
}
