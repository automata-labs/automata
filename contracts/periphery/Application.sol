// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/IAccumulator.sol";
import "../interfaces/IOperator.sol";
import "../interfaces/IToken.sol";
import "../libraries/helpers/TransferHelper.sol";

struct MintParams {
    address token;

    address sequencer;
    address operator;
    address accumulator;
    address vToken;

    address to;
    uint128 amount;
}

struct GrowParams {
    uint256 id;
    address token;

    address sequencer;
    address operator;
    address accumulator;
    address vToken;

    address to;
    uint128 amount;
}

struct BurnParams {
    uint256 id;

    address sequencer;
    address operator;
    address accumulator;
    address vToken;

    address to;
    uint128 amount;
}

struct VoteParams {
    address operator;
    address accumulator;
    address vToken;

    uint256 pid;
    uint8 support;
    uint128 amount;
}

contract Application {
    using TransferHelper for address;

    function mint(MintParams memory params) external returns (uint256 id, uint128 amount) {
        params.token.safeTransferFrom(msg.sender, params.sequencer, params.amount);

        IOperator(params.operator).join(params.accumulator, params.vToken);
        require(IToken(params.vToken).mint(params.to) >= params.amount, "Insufficiently minted");
        (id, amount) = IAccumulator(params.accumulator).mint(params.token, params.to);
        require(amount >= params.amount, "Insufficiently staked");
    }

    function grow(GrowParams memory params) external {
        params.token.safeTransferFrom(msg.sender, params.sequencer, params.amount);

        IOperator(params.operator).join(params.accumulator, params.vToken);
        require(IToken(params.vToken).mint(params.to) >= params.amount, "Insufficiently minted");
        require(IAccumulator(params.accumulator).stake(params.id) >= params.amount, "Insufficiently staked");
    }

    function burn(BurnParams memory params) external {
        params.vToken.safeTransferFrom(msg.sender, params.vToken, params.amount);

        require(IToken(params.vToken).burn(params.operator) >= params.amount, "Insufficiently minted");
        IAccumulator(params.accumulator).unstake(params.id, params.operator, params.amount);
        require(IOperator(params.operator).exit(params.to) >= params.amount, "Insufficiently exited");
    }

    function vote(VoteParams memory params) external {
        params.vToken.safeTransferFrom(msg.sender, params.vToken, params.amount);
        require(IToken(params.vToken).burn(params.accumulator) >= params.amount, "Insufficiently burned");
        require(IOperator(params.operator).use(params.pid, params.support) >= params.amount, "Insufficiently voted");
    }
}
