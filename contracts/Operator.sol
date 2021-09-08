// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IOperator.sol";
import "./interfaces/IOperatorEvents.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import "./interfaces/IKernel.sol";
import "./interfaces/IOperatorFactory.sol";
import "./interfaces/ISequencer.sol";
import "./interfaces/external/IGovernorAlpha.sol";
import "./libraries/access/Access.sol";
import "./libraries/data/Slot.sol";
import "./libraries/math/Cast.sol";
import "./libraries/utils/Lock.sol";
import "./libraries/utils/Multicall.sol";
import "./libraries/utils/Shell.sol";

/// @title Operator
contract Operator is IOperator, IOperatorEvents, Access, Lock, Multicall {
    using Cast for uint256;
    using Cast for uint128;
    using Shell for IKernel;

    /// @inheritdoc IOperator
    IKernel public immutable override kernel;
    /// @inheritdoc IOperator
    address public immutable override underlying;

    /// @inheritdoc IOperator
    ISequencer public override sequencer;
    /// @inheritdoc IOperator
    address public override governor;

    struct Frozen {
        uint256 id;
        bool frozen;
    }
    /// @inheritdoc IOperator
    Frozen public override frozen;

    constructor() {
        (kernel, underlying) = IOperatorFactory(msg.sender).parameters();
    }

    function set(bytes32 key, bytes memory data) external auth {
        if (key == "sequencer") sequencer = abi.decode(data, (ISequencer));
        else if (key == "governor") governor = abi.decode(data, (address));
        else revert("!");
    }

    function freeze(uint256 pid) external override {
        // governor is considered active on either `Pending` or `Active` states
        // `virtualize` should be frozen when governor is active
        if (IGovernorAlpha(governor).state(pid) == 0 || IGovernorAlpha(governor).state(pid) == 1) {
            frozen.frozen = true;
            frozen.id = pid;
        }
    }

    function unfreeze() external override {
        if (IGovernorAlpha(governor).state(frozen.id) > 0) {
            frozen.frozen = false;
            frozen.id = 0;
        }
    }

    /// @inheritdoc IOperator
    function virtualize(address tox, address toy) external override lock {
        require(frozen.frozen == false, "FROZEN");

        uint256 amount = sequencer.deposit();
        // FIXME: Use multicall to save gas
        kernel.modify(underlying, tox, amount.u128().i128(), 0);
        kernel.modify(underlying, toy, 0, amount.u128().i128());

        emit Joined(msg.sender, tox, toy, amount.u128());
    }

    /// @inheritdoc IOperator
    function realize(address to) external override lock {
        Slot.Data memory slot = kernel.fetch(underlying, address(this));
        uint128 amount = Math.min(slot.x, slot.y).u128();
        kernel.modify(underlying, address(this), -amount.i128(), -amount.i128());
        sequencer.withdraw(to, amount);

        emit Exited(msg.sender, to, amount);
    }

    /// @inheritdoc IOperator
    function transfer(address to, uint128 x, uint128 y) external override lock {
        kernel.move(underlying, msg.sender, to, x, y);
    }

    /// @inheritdoc IOperator
    function pay(address token, address to, uint256 value) external override {
        TransferHelper.safeTransferFrom(token, msg.sender, to, value);
    }
}
