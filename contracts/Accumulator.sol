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

    /// @inheritdoc IAccumulator
    IKernel public immutable override kernel;

    /// @inheritdoc IAccumulator
    mapping(address => State.Data) public override accumulators;
    /// @inheritdoc IAccumulator
    mapping(bytes32 => State.Data) public override states;

    constructor(IKernel kernel_) {
        kernel = kernel_;
    }

    /// @inheritdoc IAccumulator
    function getAccumulator(address underlying) external view override returns (State.Data memory) {
        return accumulators[underlying];
    }

    /// @inheritdoc IAccumulator
    function getState(address underlying, address owner) external view override returns (State.Data memory) {
        return states.get(underlying, owner).normalize(accumulators[underlying].x128);
    }

    /// @inheritdoc IAccumulator
    function grow(address underlying) external override returns (uint128 amount) {
        amount = kernel.fetch(underlying, address(this)).y - accumulators[underlying].y;

        accumulators[underlying].y += amount;
        accumulators[underlying].x128 += FullMath.mulDiv(
            amount,
            FixedPoint.Q128,
            accumulators[underlying].x
        );
    }

    /// @inheritdoc IAccumulator
    function stake(address underlying, address to) external override returns (uint128 x) {
        x = kernel.fetch(underlying, address(this)).x - accumulators[underlying].x;

        State.Data memory stateNext = states.get(underlying, to).normalize(accumulators[underlying].x128);

        accumulators[underlying].x += x;
        states.get(underlying, to).x = stateNext.x + x;
        states.get(underlying, to).y = stateNext.y;
        states.get(underlying, to).x128 = stateNext.x128;
    }

    /// @inheritdoc IAccumulator
    function unstake(address underlying, address to, uint128 x) external override {
        State.Data memory stateNext = states.get(underlying, msg.sender).normalize(accumulators[underlying].x128);

        accumulators[underlying].x -= x;
        states.get(underlying, msg.sender).x = stateNext.x - x;
        states.get(underlying, msg.sender).y = stateNext.y;
        states.get(underlying, msg.sender).x128 = stateNext.x128;

        kernel.move(underlying, address(this), to, x, 0);
    }

    /// @inheritdoc IAccumulator
    function collect(address underlying, address to, uint128 y) external override returns (uint128 amount) {
        State.Data memory stateNext = states.get(underlying, msg.sender).normalize(accumulators[underlying].x128);

        amount = (y > accumulators[underlying].y) ? accumulators[underlying].y : y;

        accumulators[underlying].y -= amount;
        states.get(underlying, msg.sender).y = stateNext.y - amount;
        states.get(underlying, msg.sender).x128 = stateNext.x128;

        kernel.move(underlying, address(this), to, 0, amount);
    }
}
