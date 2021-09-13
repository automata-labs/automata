// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IAccumulator.sol";

import "./interfaces/IKernel.sol";
import "./libraries/data/State.sol";
import "./libraries/math/Cast.sol";
import "./libraries/math/FixedPoint.sol";
import "./libraries/math/FullMath.sol";
import "./libraries/utils/Shell.sol";

/// @title Accumulator
contract Accumulator is IAccumulator {
    using Cast for uint256;
    using Shell for IKernel;
    using State for mapping(bytes32 => State.Data);
    using State for State.Data;

    /// @inheritdoc IAccumulatorImmutables
    IKernel public immutable override kernel;

    /// @inheritdoc IAccumulatorState
    mapping(address => State.Data) public override accumulators;
    /// @inheritdoc IAccumulatorState
    mapping(bytes32 => State.Data) public override states;

    constructor(IKernel kernel_) {
        kernel = kernel_;
    }

    /// @inheritdoc IAccumulatorStateDerived
    function get(address underlying, address owner) external view override returns (State.Data memory) {
        State.Data memory state = states.get(underlying, owner);
        state.y += FullMath.mulDiv(state.x, accumulators[underlying].x128 - state.x128, FixedPoint.Q128).u128();
        state.x128 = accumulators[underlying].x128;

        return state;
    }

    /// @inheritdoc IAccumulatorFunctions
    function grow(address underlying) external override returns (uint128 y) {
        y = kernel.get(underlying, address(this)).y - accumulators[underlying].y;

        accumulators[underlying].y += y;
        accumulators[underlying].x128 += FullMath.mulDiv(y, FixedPoint.Q128, accumulators[underlying].x);

        emit Grown(underlying, y);
    }

    /// @inheritdoc IAccumulatorFunctions
    function stake(address underlying, address to) external override returns (uint128 x) {
        x = kernel.get(underlying, address(this)).x - accumulators[underlying].x;

        State.Data storage state = states.get(underlying, to);
        state.y += FullMath.mulDiv(state.x, accumulators[underlying].x128 - state.x128, FixedPoint.Q128).u128();
        state.x += x;
        state.x128 = accumulators[underlying].x128;
        accumulators[underlying].x += x;

        emit Staked(msg.sender, underlying, to, x);
    }

    /// @inheritdoc IAccumulatorFunctions
    function unstake(address underlying, address to, uint128 x) external override {
        State.Data storage state = states.get(underlying, msg.sender);
        state.y += FullMath.mulDiv(state.x, accumulators[underlying].x128 - state.x128, FixedPoint.Q128).u128();
        state.x -= x;
        state.x128 = accumulators[underlying].x128;
        accumulators[underlying].x -= x;

        kernel.move(underlying, address(this), to, x, 0);

        emit Unstaked(msg.sender, underlying, to, x);
    }

    /// @inheritdoc IAccumulatorFunctions
    function collect(address underlying, address to, uint128 y) external override returns (uint128 c) {
        c = (y > accumulators[underlying].y) ? accumulators[underlying].y : y;

        State.Data storage state = states.get(underlying, msg.sender);
        state.y += FullMath.mulDiv(state.x, accumulators[underlying].x128 - state.x128, FixedPoint.Q128).u128();
        state.y -= c;
        state.x128 = accumulators[underlying].x128;
        accumulators[underlying].y -= c;

        kernel.move(underlying, address(this), to, 0, c);

        emit Collected(msg.sender, underlying, to, c);
    }
}
