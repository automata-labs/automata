// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../interfaces/IAccumulator.sol";

import "../abstracts/ERC721Permit.sol";
import "../interfaces/IKernel.sol";
import "../libraries/data/Pool.sol";
import "../libraries/data/Stake.sol";
import "../libraries/helpers/Shell.sol";
import "../libraries/math/Cast.sol";
import "../libraries/math/FixedPoint.sol";
import "../libraries/math/FullMath.sol";

/// @title Accumulator
contract Accumulator is IAccumulator, ERC721Permit {
    using Cast for uint128;
    using Pool for Pool.Data;
    using Shell for IKernel;
    using Stake for Stake.Data;

    /// @inheritdoc IAccumulatorImmutables
    IKernel public immutable kernel;
    /// @inheritdoc IAccumulatorState
    mapping(address => Pool.Data) public pools;
    /// @inheritdoc IAccumulatorState
    mapping(uint256 => Stake.Data) public stakes;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint256 private _id = 1;

    modifier isAuthorizedForToken(uint256 id) {
        require(_isApprovedOrOwner(msg.sender, id), "Not approved");
        _;
    }

    constructor(IKernel kernel_) ERC721Permit("Automata NFT V1", "AAAA-NFT0", "1") {
        kernel = kernel_;
    }

    /// @inheritdoc IAccumulatorStateDerived
    function next() external view returns (uint256) {
        return _id;
    }

    /// @inheritdoc IAccumulatorStateDerived
    function get(uint256 id) external view returns (Stake.Data memory) {
        return stakes[id].normalize(pools[stakes[id].coin].x128);
    }

    /// @inheritdoc IAccumulatorFunctions
    function mint(address coin, address to) external returns (uint256 id, uint128 dx) {
        id = _id++;
        dx = kernel.get(coin, address(this)).x - pools[coin].x;

        _safeMint(to, id);
        stakes[id] = Stake.Data({
            nonce: 0,
            coin: coin,
            x: dx,
            y: 0,
            x128: pools[coin].x128
        });
        pools[coin].modify(dx.i128(), 0, 0);

        emit Picked(id, coin);
        emit Staked(id, dx);
    }

    /// @inheritdoc IAccumulatorFunctions
    function burn(uint256 id) external isAuthorizedForToken(id) {
        require(stakes[id].x == 0 && stakes[id].y == 0, "!0");
        delete stakes[id];
        _burn(id);

        emit Picked(id, address(0));
    }

    /// @inheritdoc IAccumulatorFunctions
    function stake(uint256 id) external returns (uint128 dx) {
        address coin = stakes[id].coin;
        require(coin != address(0), "A0");

        dx = kernel.get(coin, address(this)).x - pools[coin].x;
        require(dx > 0, "0");

        stakes[id].modify(dx.i128(), 0, pools[coin].x128);
        pools[coin].modify(dx.i128(), 0, 0);

        emit Staked(id, dx);
    }

    /// @inheritdoc IAccumulatorFunctions
    function unstake(uint256 id, address to, uint128 dx) external isAuthorizedForToken(id) {
        require(dx > 0, "0");

        address coin = stakes[id].coin;
        stakes[id].modify(-dx.i128(), 0, pools[coin].x128);
        pools[coin].modify(-dx.i128(), 0, 0);
        kernel.transfer(coin, address(this), to, dx, 0);

        emit Unstaked(id, to, dx);
    }

    /// @inheritdoc IAccumulatorFunctions
    function collect(uint256 id, address to, uint128 dy) external isAuthorizedForToken(id) returns (uint128 c) {
        address coin = stakes[id].coin;
        uint128 ddy = stakes[id].normalize(pools[coin].x128).y;
        c = (dy > ddy) ? ddy : dy;
        require(c > 0, "0");

        stakes[id].modify(0, -c.i128(), pools[coin].x128);
        pools[coin].modify(0, -c.i128(), 0);
        kernel.transfer(coin, address(this), to, 0, c);

        emit Collected(id, to, dy);
    }

    /// @inheritdoc IAccumulatorFunctions
    function pick(uint256 id, address coin) external isAuthorizedForToken(id) {
        require(stakes[id].x == 0, "!0");
        require(stakes[id].y == 0, "!0");
        stakes[id].coin = coin;

        emit Picked(id, coin);
    }

    /// @inheritdoc IAccumulatorFunctions
    function grow(address coin) external returns (uint128 dy) {
        require(pools[coin].x > 0, "DIV0");
        dy = kernel.get(coin, address(this)).y - pools[coin].y;
        require(dy > 0, "0");
        pools[coin].modify(0, dy.i128(), FullMath.mulDiv(dy, FixedPoint.Q128, pools[coin].x));

        emit Grown(coin, dy);
    }

    function _getAndIncrementNonce(uint256 id) internal override returns (uint256) {
        return uint256(stakes[id].nonce++);
    }
}
