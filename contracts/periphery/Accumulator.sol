// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/IAccumulator.sol";

import "../interfaces/IKernel.sol";
import "../libraries/data/State.sol";
import "../libraries/helpers/Global.sol";
import "../libraries/helpers/Shell.sol";
import "../libraries/helpers/Unit.sol";
import "../libraries/math/Cast.sol";
import "../libraries/math/FixedPoint.sol";
import "../libraries/math/FullMath.sol";

/// @title Accumulator
contract Accumulator is IAccumulator {
    using Global for mapping(address => State.Data);
    using Global for State.Data;
    using Cast for uint128;
    using Shell for IKernel;
    using Unit for mapping(bytes32 => State.Data);
    using Unit for State.Data;

    /// @inheritdoc IAccumulatorImmutables
    IKernel public immutable override kernel;

    /// @inheritdoc IAccumulatorState
    mapping(address => State.Data) public override globs;
    /// @inheritdoc IAccumulatorState
    mapping(bytes32 => State.Data) public override units;

    constructor(IKernel kernel_) {
        kernel = kernel_;
    }

    /// @inheritdoc IAccumulatorStateDerived
    function get(address underlying, address owner) external view override returns (State.Data memory) {
        return units.get(underlying, owner).normalize(globs[underlying].x128);
    }

    /// @inheritdoc IAccumulatorFunctions
    function grow(address underlying) external override returns (uint128 y) {
        y = kernel.get(underlying, address(this)).y - globs[underlying].y;

        uint256 x128a = FullMath.mulDiv(y, FixedPoint.Q128, globs[underlying].x);
        globs.get(underlying).modify0(0, y.i128(), x128a);

        emit Grown(underlying, y);
    }

    /// @inheritdoc IAccumulatorFunctions
    function stake(address underlying, address to) external override returns (uint128 x) {
        x = kernel.get(underlying, address(this)).x - globs[underlying].x;

        globs.get(underlying)    .modify0(x.i128(), 0, 0);
        units.get(underlying, to).modify1(x.i128(), 0, globs[underlying].x128);

        emit Staked(msg.sender, underlying, to, x);
    }

    /// @inheritdoc IAccumulatorFunctions
    function unstake(address underlying, address to, uint128 x) external override {
        globs.get(underlying)    .modify0(-x.i128(), 0, 0);
        units.get(underlying, to).modify1(-x.i128(), 0, globs[underlying].x128);

        kernel.transfer(underlying, address(this), to, x, 0);

        emit Unstaked(msg.sender, underlying, to, x);
    }

    /// @inheritdoc IAccumulatorFunctions
    function collect(address underlying, address to, uint128 y) external override returns (uint128 c) {
        State.Data memory unit = units.get(underlying, to).normalize(globs[underlying].x128);
        c = (y > unit.y) ? unit.y : y;

        globs.get(underlying)    .modify0(0, -c.i128(), 0);
        units.get(underlying, to).modify1(0, -c.i128(), globs[underlying].x128);

        kernel.transfer(underlying, address(this), to, 0, c);

        emit Collected(msg.sender, underlying, to, c);
    }
}
