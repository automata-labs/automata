// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

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

interface IApplicationFunctions {
    /// @notice Mint an ERC721 and stake, and mint vTokens.
    /// @dev Requires the `msg.sender` to approve/permit the coin address.
    function mint(MintParams memory params) external returns (uint256 id, uint128 amount);

    /// @notice Deposit additional coins into an ERC721 stake and mint vTokens.
    /// @dev Requires the `msg.sender` to approve/permit to both the coin and the ERC721.
    function grow(GrowParams memory params) external;

    /// @notice Burn vTokens and unstake to get back underlying coins.
    /// @dev Requires the `msg.sender` to approve/permit to both the coin and the ERC721.
    function burn(BurnParams memory params) external;

    /// @notice Vote internally inside of the program.
    /// @dev Requires the `msg.sender` to approve/permit the vToken.
    function vote(VoteParams memory params) external;
}
