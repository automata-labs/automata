// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/IAccumulator.sol";

import "../interfaces/IKernel.sol";
import "../libraries/data/Glob.sol";
import "../libraries/data/Unit.sol";
import "../libraries/helpers/Shell.sol";
import "../libraries/math/Cast.sol";
import "../libraries/math/FixedPoint.sol";
import "../libraries/math/FullMath.sol";

/// @title Accumulator
contract Accumulator is IAccumulator {
    using Glob for mapping(address => Glob.Data);
    using Glob for Glob.Data;
    using Cast for uint128;
    using Shell for IKernel;
    using Unit for mapping(bytes32 => Unit.Data);
    using Unit for Unit.Data;

    /// @inheritdoc IAccumulatorImmutables
    IKernel public immutable kernel;

    /// @inheritdoc IAccumulatorState
    mapping(address => Glob.Data) public globs;
    /// @inheritdoc IAccumulatorState
    mapping(bytes32 => Unit.Data) public units;

    constructor(IKernel kernel_) {
        kernel = kernel_;
    }

    /// @inheritdoc IAccumulatorStateDerived
    function get(address coin, address owner) external view returns (Unit.Data memory) {
        return units.get(coin, owner).normalize(globs[coin].x128);
    }

    /// @inheritdoc IAccumulatorFunctions
    function grow(address coin) external returns (uint128 dy) {
        require(globs[coin].x > 0, "DIV0");
        dy = kernel.get(coin, address(this)).y - globs[coin].y;
        require(dy > 0, "0");

        uint256 x128a = FullMath.mulDiv(dy, FixedPoint.Q128, globs[coin].x);
        globs.get(coin).modify(0, dy.i128(), x128a);

        emit Grown(msg.sender, coin, dy);
    }

    /// @inheritdoc IAccumulatorFunctions
    function stake(address coin, address to) external returns (uint128 dx) {
        dx = kernel.get(coin, address(this)).x - globs[coin].x;
        require(dx > 0, "0");

        units.get(coin, to).modify(dx.i128(), 0, globs[coin].x128);
        globs.get(coin)    .modify(dx.i128(), 0, 0);

        emit Staked(msg.sender, coin, to, dx);
    }

    /// @inheritdoc IAccumulatorFunctions
    function unstake(address coin, address to, uint128 dx) external {
        require(dx > 0, "0");

        units.get(coin, msg.sender).modify(-dx.i128(), 0, globs[coin].x128);
        globs.get(coin)            .modify(-dx.i128(), 0, 0);
        kernel.transfer(coin, address(this), to, dx, 0);

        emit Unstaked(msg.sender, coin, to, dx);
    }

    /// @inheritdoc IAccumulatorFunctions
    function collect(address coin, address to, uint128 dy) external returns (uint128 c) {
        uint128 y = units.get(coin, to).normalize(globs[coin].x128).y;
        c = (dy > y) ? y : dy;
        require(c > 0, "0");

        units.get(coin, to).modify(0, -c.i128(), globs[coin].x128);
        globs.get(coin)    .modify(0, -c.i128(), 0);
        kernel.transfer(coin, address(this), to, 0, c);

        emit Collected(msg.sender, coin, to, c);
    }
}
