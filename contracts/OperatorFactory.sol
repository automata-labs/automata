// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IOperatorFactory.sol";
import "./interfaces/IOperatorFactoryEvents.sol";

import "./Operator.sol";
import "./interfaces/IKernel.sol";
import "./interfaces/IOperator.sol";
import "./libraries/access/Access.sol";

/// @title OperatorFactory
contract OperatorFactory is IOperatorFactory, IOperatorFactoryEvents {
    bytes32 public constant OPERATOR_BYTECODE_HASH = keccak256(type(Operator).creationCode);

    struct Parameters {
        IKernel kernel;
        address token;
    }
    /// @inheritdoc IOperatorFactory
    Parameters public override parameters;
    /// @inheritdoc IOperatorFactory
    IKernel public immutable override kernel;

    constructor(IKernel kernel_) {
        kernel = kernel_;
    }

    /// @inheritdoc IOperatorFactory
    function create(address token) external override {
        parameters = Parameters({ kernel: kernel, token: token });
        Access operator = Access(new Operator{salt: keccak256(abi.encode(token))}());
        operator.grantRole(operator.ROOT(), msg.sender);
        operator.revokeRole(operator.ROOT(), address(this));
        delete parameters;

        emit Created(token, address(operator));
    }

    /// @inheritdoc IOperatorFactory
    function compute(address token) external view override returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this),
                            keccak256(abi.encode(token)),
                            OPERATOR_BYTECODE_HASH
                        )
                    )
                )
            )
        );
    }
}
