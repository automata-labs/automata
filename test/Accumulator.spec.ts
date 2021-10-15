import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { erc20CompLikeFixture } from './shared/fixtures';
import { functions } from './shared/functions';
import { deploy, e18, MaxUint128, Q128, ROOT } from './shared/utils';
import { Accumulator, ERC20CompLike, Kernel, OperatorA, Sequencer } from '../typechain';

const { MaxUint256 } = ethers.constants;
const { loadFixture, provider } = waffle;

describe('Accumulator', async () => {
  let abi = new ethers.utils.AbiCoder();
  let wallet;
  let other1;
  let other2;

  let token: ERC20CompLike;
  let kernel: Kernel;
  let accumulator: Accumulator;
  let sequencer: Sequencer;
  let operator: OperatorA;

  let read: Function;
  let join: Function;

  const fixture = async () => {
    ([wallet, other1, other2] = await ethers.getSigners());

    token = await erc20CompLikeFixture(provider, wallet);

    kernel = (await deploy('Kernel')) as Kernel;
    accumulator = (await deploy('Accumulator', kernel.address)) as Accumulator;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', token.address, kernel.address)) as OperatorA;

    // setup
    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, accumulator.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [e18(10000)]));

    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(10);

    ({ read, join } = functions({ token, kernel, accumulator, sequencer, operator }));
  };

  describe('#mint', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should mint nft only', async () => {
      const id = await accumulator.next();
      await accumulator.mint(token.address, wallet.address);

      expect(await accumulator.ownerOf(id)).to.equal(wallet.address);
      expect(await accumulator.balanceOf(wallet.address)).to.equal(1);

      expect((await accumulator.stakes(id)).nonce).to.equal(0);
      expect((await accumulator.stakes(id)).coin).to.equal(token.address);
      expect((await accumulator.stakes(id)).x).to.equal(0);
      expect((await accumulator.stakes(id)).y).to.equal(0);
      expect((await accumulator.stakes(id)).x128).to.equal(0);

      expect((await accumulator.pools(token.address)).x).to.equal(0);
      expect((await accumulator.pools(token.address)).y).to.equal(0);
      expect((await accumulator.pools(token.address)).x128).to.equal(0);
    });
    it('should mint nft with 1', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, wallet.address, 1);
      await accumulator.mint(token.address, wallet.address);

      expect(await accumulator.ownerOf(id)).to.equal(wallet.address);
      expect(await accumulator.balanceOf(wallet.address)).to.equal(1);

      expect((await accumulator.stakes(id)).nonce).to.equal(0);
      expect((await accumulator.stakes(id)).coin).to.equal(token.address);
      expect((await accumulator.stakes(id)).x).to.equal(1);
      expect((await accumulator.stakes(id)).y).to.equal(0);
      expect((await accumulator.stakes(id)).x128).to.equal(0);

      expect((await accumulator.pools(token.address)).x).to.equal(1);
      expect((await accumulator.pools(token.address)).y).to.equal(0);
      expect((await accumulator.pools(token.address)).x128).to.equal(0);
    });
    it('should mint multiple nfts', async () => {
      const id1 = await accumulator.next();
      await accumulator.connect(wallet).mint(token.address, wallet.address);
      const id2 = await accumulator.next();
      await accumulator.connect(other1).mint(token.address, other1.address);
      const id3 = await accumulator.next();
      await accumulator.connect(wallet).mint(token.address, wallet.address);

      expect(await accumulator.ownerOf(id1)).to.equal(wallet.address);
      expect(await accumulator.ownerOf(id2)).to.equal(other1.address);
      expect(await accumulator.ownerOf(id3)).to.equal(wallet.address);
      expect(await accumulator.balanceOf(wallet.address)).to.equal(2);
      expect(await accumulator.balanceOf(other1.address)).to.equal(1);

      for (let i = 1; i <= 3; i++) {
        expect((await accumulator.stakes(eval(`id${i}`))).nonce).to.equal(0);
        expect((await accumulator.stakes(eval(`id${i}`))).coin).to.equal(token.address);
        expect((await accumulator.stakes(eval(`id${i}`))).x).to.equal(0);
        expect((await accumulator.stakes(eval(`id${i}`))).y).to.equal(0);
        expect((await accumulator.stakes(eval(`id${i}`))).x128).to.equal(0);
      }

      expect((await accumulator.pools(token.address)).x).to.equal(0);
      expect((await accumulator.pools(token.address)).y).to.equal(0);
      expect((await accumulator.pools(token.address)).x128).to.equal(0);
    });
    it('should mint to another account', async () => {
      const id = await accumulator.next();
      await accumulator.connect(wallet).mint(token.address, other1.address);

      expect(await accumulator.ownerOf(id)).to.equal(other1.address);
      expect(await accumulator.balanceOf(wallet.address)).to.equal(0);
      expect(await accumulator.balanceOf(other1.address)).to.equal(1);
    });
  });

  describe('#burn', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should burn', async () => {
      // mint
      const id = await accumulator.next();
      await join(wallet, accumulator.address, wallet.address, 1);
      await accumulator.mint(token.address, wallet.address);
      // unstake
      await accumulator.unstake(id, wallet.address, 1);
      // burn
      await accumulator.burn(id);

      await expect(accumulator.ownerOf(id)).to.be.revertedWith('ERC721: owner query for nonexistent token');
      expect(await accumulator.balanceOf(wallet.address)).to.equal(0);

      expect((await accumulator.stakes(id)).nonce).to.equal(0);
      expect((await accumulator.stakes(id)).coin).to.equal(ethers.constants.AddressZero);
      expect((await accumulator.stakes(id)).x).to.equal(0);
      expect((await accumulator.stakes(id)).y).to.equal(0);
      expect((await accumulator.stakes(id)).x128).to.equal(0);

      expect((await accumulator.pools(token.address)).x).to.equal(0);
      expect((await accumulator.pools(token.address)).y).to.equal(0);
      expect((await accumulator.pools(token.address)).x128).to.equal(0);
    });
    it('should revert when nft\'s `x` not zero', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, wallet.address, 1);
      await accumulator.mint(token.address, wallet.address);

      await expect(accumulator.burn(id)).to.be.revertedWith('!0');
    });
    it('should revert when nft\'s `y` not zero', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, 1);
      await accumulator.mint(token.address, wallet.address);
      await accumulator.grow(token.address);
      await accumulator.unstake(id, wallet.address, 1);

      await expect(accumulator.burn(id)).to.be.revertedWith('!0');
    });
    it('should revert when caller not approved', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, wallet.address, 1);
      await accumulator.mint(token.address, wallet.address);
      await accumulator.unstake(id, wallet.address, 1);

      await expect(accumulator.connect(other1).burn(id)).to.be.revertedWith('Not approved');
      await expect(accumulator.connect(other2).burn(id)).to.be.revertedWith('Not approved');
    });
  });

  describe('#stake', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should stake', async () => {
      const id = await accumulator.next();
      // mint
      await join(wallet, accumulator.address, wallet.address, 1);
      await accumulator.mint(token.address, wallet.address);
      
      // stake
      await join(wallet, accumulator.address, wallet.address, 1);
      await accumulator.stake(id);

      expect(await accumulator.ownerOf(id)).to.equal(wallet.address);
      expect(await accumulator.balanceOf(wallet.address)).to.equal(1);

      expect((await accumulator.stakes(id)).nonce).to.equal(0);
      expect((await accumulator.stakes(id)).coin).to.equal(token.address);
      expect((await accumulator.stakes(id)).x).to.equal(2);
      expect((await accumulator.stakes(id)).y).to.equal(0);
      expect((await accumulator.stakes(id)).x128).to.equal(0);

      expect((await accumulator.pools(token.address)).x).to.equal(2);
      expect((await accumulator.pools(token.address)).y).to.equal(0);
      expect((await accumulator.pools(token.address)).x128).to.equal(0);
    });
    it('should stake to another account', async () => {
      const id = await accumulator.next();
      // mint with other1
      await accumulator.mint(token.address, other1.address);

      // join with wallet, stake to other1
      await join(wallet, accumulator.address, wallet.address, e18(100));
      await accumulator.stake(id);

      expect((await accumulator.stakes(id)).x).to.equal(e18(100));
      expect((await accumulator.stakes(id)).y).to.equal(0);
      expect((await accumulator.stakes(id)).x128).to.equal(0);

      expect((await accumulator.pools(token.address)).x).to.equal(e18(100));
      expect((await accumulator.pools(token.address)).y).to.equal(0);
      expect((await accumulator.pools(token.address)).x128).to.equal(0);
    });
    it('should stake and auto-update `y`', async () => {
      const id = await accumulator.next();
      // mint
      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.mint(token.address, other1.address);

      // grow so that there's tokens to collect
      await accumulator.grow(token.address);

      // should update `y` when staking on existing stake
      await join(wallet, accumulator.address, wallet.address, e18(100));
      await accumulator.stake(id);

      expect((await accumulator.stakes(id)).x).to.equal(e18(200));
      expect((await accumulator.stakes(id)).y).to.equal(e18(100));
      expect((await accumulator.stakes(id)).x128).to.equal(Q128);

      expect((await accumulator.pools(token.address)).x).to.equal(e18(200));
      expect((await accumulator.pools(token.address)).y).to.equal(e18(100));
      expect((await accumulator.pools(token.address)).x128).to.equal(Q128);
    });
    it('should stake from multiple accounts', async () => {
      const id = await accumulator.next();
      await accumulator.mint(token.address, wallet.address);

      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.stake(id);
      await token.transfer(other1.address, e18(50));
      await join(other1, accumulator.address, accumulator.address, e18(50));
      await accumulator.stake(id);
      await token.transfer(other2.address, e18(25));
      await join(other2, accumulator.address, accumulator.address, e18(25));
      await accumulator.stake(id);

      expect((await accumulator.pools(token.address)).x).to.equal(e18(175));
      expect((await accumulator.pools(token.address)).y).to.equal(0);
      expect((await accumulator.pools(token.address)).x128).to.equal(0);
    });
    it('should revert when staking invalid id', async () => {
      await expect(accumulator.stake(333)).to.be.revertedWith('A0');
    });
    it('should revert when staking zero', async () => {
      const id = await accumulator.next();
      await accumulator.mint(token.address, wallet.address);
      await expect(accumulator.stake(id)).to.be.revertedWith('0');
    });
    it('should emit an event', async () => {
      const id = await accumulator.next();
      await accumulator.mint(token.address, wallet.address);
      await join(wallet, accumulator.address, accumulator.address, e18(100));

      await expect(accumulator.stake(id)).to.emit(accumulator, 'Staked')
        .withArgs(id, e18(100));
    });
  });

  describe('#unstake', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should unstake', async () => {
      const id = await accumulator.next();
      // mint
      await join(wallet, accumulator.address, wallet.address, 1);
      await accumulator.mint(token.address, wallet.address);

      expect((await read(token.address, wallet.address)).x).to.equal(0);
      expect((await read(token.address, wallet.address)).y).to.equal(1);

      // unstake
      await accumulator.unstake(id, wallet.address, 1);

      expect(await accumulator.ownerOf(id)).to.equal(wallet.address);
      expect(await accumulator.balanceOf(wallet.address)).to.equal(1);

      expect((await accumulator.stakes(id)).nonce).to.equal(0);
      expect((await accumulator.stakes(id)).coin).to.equal(token.address);
      expect((await accumulator.stakes(id)).x).to.equal(0);
      expect((await accumulator.stakes(id)).y).to.equal(0);
      expect((await accumulator.stakes(id)).x128).to.equal(0);

      expect((await accumulator.pools(token.address)).x).to.equal(0);
      expect((await accumulator.pools(token.address)).y).to.equal(0);
      expect((await accumulator.pools(token.address)).x128).to.equal(0);

      expect((await read(token.address, wallet.address)).x).to.equal(1);
      expect((await read(token.address, wallet.address)).y).to.equal(1);
    });
    it('should unstake using approval', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, wallet.address, 1);
      await accumulator.mint(token.address, wallet.address);
      await accumulator.approve(other1.address, id);

      // unstake using approval on another account
      await accumulator.connect(other1).unstake(id, other1.address, 1);

      expect((await accumulator.stakes(id)).nonce).to.equal(0);
      expect((await accumulator.stakes(id)).coin).to.equal(token.address);
      expect((await accumulator.stakes(id)).x).to.equal(0);
      expect((await accumulator.stakes(id)).y).to.equal(0);
      expect((await accumulator.stakes(id)).x128).to.equal(0);

      expect((await read(token.address, other1.address)).x).to.equal(1);
      expect((await read(token.address, other1.address)).y).to.equal(0);

      expect((await read(token.address, wallet.address)).x).to.equal(0);
      expect((await read(token.address, wallet.address)).y).to.equal(1);
    });
    it('should unstake and auto-update `y`', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.mint(token.address, wallet.address);
      await accumulator.grow(token.address);

      // should update `y` when staking on existing stake
      await accumulator.unstake(id, wallet.address, e18(100));
      expect((await accumulator.stakes(id)).x).to.equal(0);
      expect((await accumulator.stakes(id)).y).to.equal(e18(100));
      expect((await accumulator.stakes(id)).x128).to.equal(Q128);
    });
    it('should revert when unstaking invalid id', async () => {
      await expect(accumulator.unstake(333, wallet.address, 1)).to.be.revertedWith('ERC721: operator query for nonexistent token');
    });
    it('should revert when unstaking zero', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, 1);
      await accumulator.mint(token.address, wallet.address);

      // reverts
      await expect(accumulator.unstake(id, wallet.address, 0)).to.be.revertedWith('0');
    });
    it('should revert when unstake underflow', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, 1);
      await accumulator.mint(token.address, wallet.address);

      // reverts
      await expect(accumulator.unstake(id, wallet.address, 2)).to.be.revertedWith('0x11');
    });
    it('should revert when caller not approved', async () => {
      const id = await accumulator.next();
      await accumulator.mint(token.address, wallet.address);
      await expect(accumulator.connect(other1).unstake(id, wallet.address, 0)).to.be.revertedWith('Not approved');
    });
    it('should emit an event', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, wallet.address, e18(100));
      await accumulator.mint(token.address, wallet.address);

      await expect(accumulator.unstake(id, wallet.address, 1)).to.emit(accumulator, 'Unstaked')
        .withArgs(id, wallet.address, 1);
    });
  });

  describe('#collect', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should collect', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.mint(token.address, wallet.address);
      await accumulator.grow(token.address);
      await accumulator.collect(id, wallet.address, e18(100));

      // check that `y` was collected
      expect((await accumulator.get(id)).x).to.equal(e18(100));
      expect((await accumulator.get(id)).y).to.equal(0);
      expect((await accumulator.get(id)).x128).to.equal((await accumulator.pools(token.address)).x128);
      expect((await accumulator.pools(token.address)).x).to.equal(e18(100));
      expect((await accumulator.pools(token.address)).y).to.equal(0);
      
      // check that `y` is in wallet and not in accumulator anymore
      expect((await read(token.address, wallet.address)).y).to.equal(e18(100));
      expect((await read(token.address, accumulator.address)).y).to.equal(0);
    });
    it('should collect partially', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.mint(token.address, wallet.address);
      await accumulator.grow(token.address);
      await accumulator.collect(id, wallet.address, e18(75));

      expect((await accumulator.get(id)).x).to.equal(e18(100));
      expect((await accumulator.get(id)).y).to.equal(e18(25));
      expect((await accumulator.get(id)).x128).to.equal((await accumulator.pools(token.address)).x128);
      expect((await accumulator.pools(token.address)).x).to.equal(e18(100));
      expect((await accumulator.pools(token.address)).y).to.equal(e18(25));

      expect((await read(token.address, wallet.address)).x).to.equal(0);
      expect((await read(token.address, wallet.address)).y).to.equal(e18(75));
      expect((await read(token.address, accumulator.address)).x).to.equal(e18(100));
      expect((await read(token.address, accumulator.address)).y).to.equal(e18(25));
    });
    it('should revert when collecting with invalid id', async () => {
      await expect(accumulator.collect(0, wallet.address, 1)).to.be.revertedWith('ERC721: operator query for nonexistent token');
      await expect(accumulator.collect(333, wallet.address, 1)).to.be.revertedWith('ERC721: operator query for nonexistent token');
    });
    it('should revert when collecting zero', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.mint(token.address, wallet.address);

      // revert
      await expect(accumulator.collect(id, wallet.address, 0)).to.be.revertedWith('0');
      await expect(accumulator.collect(id, wallet.address, 1)).to.be.revertedWith('0');
      await expect(accumulator.collect(id, wallet.address, MaxUint128)).to.be.revertedWith('0');
    });
    it('should revert when caller not approved', async () => {
      const id = await accumulator.next();
      await accumulator.mint(token.address, wallet.address);
      await expect(accumulator.connect(other1).collect(id, other1.address, 0)).to.be.revertedWith('Not approved');
    });
    it('should emit an event', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.mint(token.address, wallet.address);
      await accumulator.grow(token.address);

      await expect(accumulator.collect(id, wallet.address, 1)).to.emit(accumulator, 'Collected')
        .withArgs(id, wallet.address, 1);
    });
  });

  describe('#grow', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should grow', async () => {
      const id = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.mint(token.address, wallet.address);
      await accumulator.grow(token.address);

      expect((await accumulator.stakes(id)).x).to.equal(e18(100));
      expect((await accumulator.stakes(id)).y).to.equal(0);
      expect((await accumulator.stakes(id)).x128).to.equal(0);
      expect((await accumulator.get(id)).x).to.equal(e18(100));
      expect((await accumulator.get(id)).y).to.equal(e18(100));
      expect((await accumulator.get(id)).x128).to.equal(Q128);

      expect((await accumulator.pools(token.address)).x).to.equal(e18(100));
      expect((await accumulator.pools(token.address)).y).to.equal(e18(100));
      expect((await accumulator.pools(token.address)).x128).to.equal(Q128);
    });
    it('should grow by 1 unit', async () => {
      const id = await accumulator.next();
      // mint
      await join(wallet, accumulator.address, wallet.address, e18(100));
      await accumulator.mint(token.address, wallet.address);

      // grow by dust (1)
      await operator.transfer(accumulator.address, 0, e18(1));
      await accumulator.grow(token.address);

      // `wallet`
      expect((await accumulator.stakes(id)).x).to.equal(e18(100));
      expect((await accumulator.stakes(id)).y).to.equal(0);
      expect((await accumulator.stakes(id)).x128).to.equal(0);
      expect((await accumulator.get(id)).x).to.equal(e18(100));
      // rounds down, so sub 1
      expect((await accumulator.get(id)).y).to.equal(e18(1).sub(1));
      expect((await accumulator.get(id)).x128).to.equal(Q128.div(100));
      expect((await accumulator.get(id)).x128).to.equal((await accumulator.pools(token.address)).x128);

      expect((await accumulator.pools(token.address)).x).to.equal(e18(100));
      expect((await accumulator.pools(token.address)).y).to.equal(e18(1));
      expect((await accumulator.pools(token.address)).x128).to.equal(Q128.div(100));
    });
    it('should grow for multiple stakers', async () => {
      const id1 = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.mint(token.address, wallet.address);
      await accumulator.grow(token.address);

      const id2 = await accumulator.next();
      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.mint(token.address, other1.address);
      await accumulator.grow(token.address);

      // `wallet`
      expect((await accumulator.get(id1)).x).to.equal(e18(100));
      expect((await accumulator.get(id1)).y).to.equal(e18(150));
      expect((await accumulator.get(id1)).x128).to.equal((await accumulator.pools(token.address)).x128);
      
      // `other1`
      expect((await accumulator.get(id2)).x).to.equal(e18(100));
      expect((await accumulator.get(id2)).y).to.equal(e18(50));
      expect((await accumulator.get(id2)).x128).to.equal((await accumulator.pools(token.address)).x128);

      expect((await accumulator.pools(token.address)).x).to.equal(e18(200));
      expect((await accumulator.pools(token.address)).y).to.equal(e18(200));
      expect((await accumulator.pools(token.address)).x128).to.equal(Q128.mul(3).div(2));
    });
    it('should revert if growing when nothing staked', async () => {
      await join(wallet, wallet.address, accumulator.address, e18(100));
      await expect(accumulator.grow(token.address)).to.be.revertedWith('DIV0');
    });
    it('should emit an event', async () => {
      await join(wallet, accumulator.address, accumulator.address, e18(100));
      await accumulator.mint(token.address, wallet.address);

      await expect(accumulator.grow(token.address)).to.emit(accumulator, 'Grown')
        .withArgs(token.address, e18(100));
    });
  });
});
