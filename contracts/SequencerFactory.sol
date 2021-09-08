// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./interfaces/ISequencerFactory.sol";

import "./Sequencer.sol";
import "./interfaces/IKernel.sol";
import "./interfaces/ISequencer.sol";
import "./libraries/access/Access.sol";

/// @title SequencerFactory
contract SequencerFactory is ISequencerFactory {
    bytes32 public constant SEQUENCER_BYTECODE_HASH = keccak256(type(Sequencer).creationCode);

    struct Parameters {
        address token;
    }
    /// @inheritdoc ISequencerFactoryState
    Parameters public override parameters;

    /// @inheritdoc ISequencerFactoryStateDerived
    function compute(address token) external view override returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this),
                            keccak256(abi.encode(token)),
                            SEQUENCER_BYTECODE_HASH
                        )
                    )
                )
            )
        );
    }

    /// @inheritdoc ISequencerFactoryFunctions
    function create(address token) external override {
        parameters = Parameters({ token: token });
        Access sequencer = Access(new Sequencer{salt: keccak256(abi.encode(token))}());
        sequencer.grantRole(sequencer.ROOT(), msg.sender);
        sequencer.revokeRole(sequencer.ROOT(), address(this));
        delete parameters;

        emit Created(token, address(sequencer));
    }
}
