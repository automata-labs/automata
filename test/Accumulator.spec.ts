import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { Accumulator, ERC20CompLike, Kernel, OperatorA, Sequencer } from '../typechain';
import { erc20CompLikeFixture } from './shared/fixtures';
import { deploy, expandTo18Decimals, MAX_UINT256, Q128, ROOT } from './shared/utils';

const { createFixtureLoader, provider } = waffle;

describe('Accumulator', async () => {
  let abi = new ethers.utils.AbiCoder();
  let loadFixture;
  let wallet;
  let other1;
  let other2;

  let token: ERC20CompLike;

  let kernel: Kernel;
  let accumulator: Accumulator;
  let sequencer: Sequencer;
  let operator: OperatorA;

  const read = (tokenAddr, walletAddr) => {
    return kernel.read(ethers.utils.keccak256(abi.encode(['address', 'address'], [tokenAddr, walletAddr])));
  };

  const globs = async (underlying: string) => {
    return accumulator.globs(underlying);
  };

  const units = async (underlying: string, owner: string) => {
    return accumulator.units(ethers.utils.keccak256(abi.encode(['address', 'address'], [underlying, owner])));
  };

  const normalized = async (underlying: string, owner: string) => {
    return accumulator.get(underlying, owner);
  };

  const join = async (caller, tox, toy, amount) => {
    await token.connect(caller).transfer(sequencer.address, amount);
    await operator.join(tox, toy);
  };

  const fixture = async () => {
    token = await erc20CompLikeFixture(provider, wallet);

    kernel = (await deploy('Kernel')) as Kernel;
    accumulator = (await deploy('Accumulator', kernel.address)) as Accumulator;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', kernel.address, token.address)) as OperatorA;

    // setup
    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, accumulator.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [expandTo18Decimals(10000)]));

    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);
  };

  before('fixture loader', async () => {
    ;([wallet, other1, other2] = await ethers.getSigners());
    loadFixture = createFixtureLoader([wallet]);
  });

  describe('#grow', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should grow', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);

      // `wallet`
      expect((await units(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await units(token.address, wallet.address)).y).to.equal(0);
      expect((await units(token.address, wallet.address)).x128).to.equal(0);

      // `wallet`
      expect((await normalized(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await normalized(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));
      expect((await normalized(token.address, wallet.address)).x128).to.equal(Q128);

      expect((await globs(token.address)).x).to.equal(expandTo18Decimals(100));
      expect((await globs(token.address)).y).to.equal(expandTo18Decimals(100));
      expect((await globs(token.address)).x128).to.equal(Q128);
    });
    it('should grow dust amount', async () => {
      await join(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await operator.transfer(accumulator.address, 0, expandTo18Decimals(1));
      await accumulator.grow(token.address);

      // `wallet`
      expect((await units(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await units(token.address, wallet.address)).y).to.equal(0);
      expect((await units(token.address, wallet.address)).x128).to.equal(0);
      expect((await normalized(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      // rounds down, so sub 1
      expect((await normalized(token.address, wallet.address)).y).to.equal(expandTo18Decimals(1).sub(1));
      expect((await normalized(token.address, wallet.address)).x128).to.equal(Q128.div(100));

      expect((await globs(token.address)).x).to.equal(expandTo18Decimals(100));
      expect((await globs(token.address)).y).to.equal(expandTo18Decimals(1));
      expect((await globs(token.address)).x128).to.equal(Q128.div(100));
    });
    it('should grow for multiple stakers', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);

      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, other1.address);
      await accumulator.grow(token.address);

      // `wallet`
      expect((await normalized(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await normalized(token.address, wallet.address)).y).to.equal(expandTo18Decimals(150));
      expect((await normalized(token.address, wallet.address)).x128).to.equal((await globs(token.address)).x128);
      
      // `other1`
      expect((await normalized(token.address, other1.address)).x).to.equal(expandTo18Decimals(100));
      expect((await normalized(token.address, other1.address)).y).to.equal(expandTo18Decimals(50));
      expect((await normalized(token.address, other1.address)).x128).to.equal((await globs(token.address)).x128);

      expect((await globs(token.address)).x).to.equal(expandTo18Decimals(200));
      expect((await globs(token.address)).y).to.equal(expandTo18Decimals(200));
      expect((await globs(token.address)).x128).to.equal(Q128.mul(3).div(2));
    });
    it('should revert if growing when nothing staked', async () => {
      await join(wallet, wallet.address, accumulator.address, expandTo18Decimals(100));
      await expect(accumulator.grow(token.address)).to.be.reverted;
    });
    it('should emit an event', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await expect(accumulator.grow(token.address))
        .to.emit(accumulator, 'Grown')
        .withArgs(token.address, expandTo18Decimals(100));
    });
  });

  describe('#stake', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should stake', async () => {
      // join and stake
      await join(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      expect((await units(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await units(token.address, wallet.address)).y).to.equal(0);
      expect((await units(token.address, wallet.address)).x128).to.equal(0);

      expect((await globs(token.address)).x).to.equal(expandTo18Decimals(100));
      expect((await globs(token.address)).y).to.equal(0);
      expect((await globs(token.address)).x128).to.equal(0);
    });
    it('should stake to another account', async () => {
      // join with `wallet`, stake with `other1`
      await join(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, other1.address);

      expect((await units(token.address, wallet.address)).x).to.equal(0);
      expect((await units(token.address, wallet.address)).y).to.equal(0);
      expect((await units(token.address, wallet.address)).x128).to.equal(0);

      expect((await units(token.address, other1.address)).x).to.equal(expandTo18Decimals(100));
      expect((await units(token.address, other1.address)).y).to.equal(0);
      expect((await units(token.address, other1.address)).x128).to.equal(0);

      expect((await globs(token.address)).x).to.equal(expandTo18Decimals(100));
      expect((await globs(token.address)).y).to.equal(0);
      expect((await globs(token.address)).x128).to.equal(0);
    });
    it('should stake and auto-update `y`', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);

      // should update `y` when staking on existing stake
      await join(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      expect((await units(token.address, wallet.address)).x).to.equal(expandTo18Decimals(200));
      expect((await units(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));
      expect((await units(token.address, wallet.address)).x128).to.equal(Q128);

      expect((await globs(token.address)).x).to.equal(expandTo18Decimals(200));
      expect((await globs(token.address)).y).to.equal(expandTo18Decimals(100));
      expect((await globs(token.address)).x128).to.equal(Q128);
    });
    it('should stake from multiple accounts', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(50));
      await accumulator.stake(token.address, other1.address);
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(25));
      await accumulator.stake(token.address, other2.address);

      expect((await globs(token.address)).x).to.equal(expandTo18Decimals(175));
      expect((await globs(token.address)).y).to.equal(0);
      expect((await globs(token.address)).x128).to.equal(0);
    });
    it('should revert when staking zero', async () => {
      await expect(accumulator.stake(token.address, wallet.address))
        .to.be.revertedWith('0');
    });
    it('should emit an event', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await expect(accumulator.stake(token.address, wallet.address))
        .to.emit(accumulator, 'Staked')
        .withArgs(wallet.address, token.address, wallet.address, expandTo18Decimals(100));
    });
  });

  describe('#unstake', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should unstake', async () => {
      // stake
      await join(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      expect((await units(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await units(token.address, wallet.address)).y).to.equal(0);
      expect((await units(token.address, wallet.address)).x128).to.equal(0);

      // unstake all
      await accumulator.unstake(token.address, wallet.address, expandTo18Decimals(100));
      expect((await units(token.address, wallet.address)).x).to.equal(0);
      expect((await units(token.address, wallet.address)).y).to.equal(0);
      expect((await units(token.address, wallet.address)).x128).to.equal(0);
    });
    it('should unstake and auto-update `y`', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);

      // should update `y` when staking on existing stake
      await accumulator.unstake(token.address, wallet.address, expandTo18Decimals(100));
      expect((await units(token.address, wallet.address)).x).to.equal(0);
      expect((await units(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));
      expect((await units(token.address, wallet.address)).x128).to.equal(Q128);
    });
    it('should revert when unstaking zero', async () => {
      await expect(accumulator.unstake(token.address, wallet.address, 0))
        .to.be.revertedWith('0');
    });
    it('should revert when unstake underflow', async () => {
      await expect(accumulator.unstake(token.address, wallet.address, 1))
        .to.be.revertedWith('0x11');
    });
    it('should emit an event', async () => {
      await join(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await expect(accumulator.unstake(token.address, wallet.address, expandTo18Decimals(100)))
        .to.emit(accumulator, 'Unstaked')
        .withArgs(wallet.address, token.address, wallet.address, expandTo18Decimals(100));
    });
  });

  describe('#collect', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should collect', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);
      await accumulator.collect(token.address, wallet.address, expandTo18Decimals(100));

      expect((await normalized(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await normalized(token.address, wallet.address)).y).to.equal(0);
      expect((await read(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));
      expect((await read(token.address, accumulator.address)).y).to.equal(0);

      expect((await globs(token.address)).x).to.equal(expandTo18Decimals(100));
      expect((await globs(token.address)).y).to.equal(0);
    });
    it('should collect partially', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);
      await accumulator.collect(token.address, wallet.address, expandTo18Decimals(75));

      expect((await normalized(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await normalized(token.address, wallet.address)).y).to.equal(expandTo18Decimals(25));
      expect((await read(token.address, wallet.address)).x).to.equal(0);
      expect((await read(token.address, wallet.address)).y).to.equal(expandTo18Decimals(75));
      expect((await read(token.address, accumulator.address)).x).to.equal(expandTo18Decimals(100));
      expect((await read(token.address, accumulator.address)).y).to.equal(expandTo18Decimals(25));

      expect((await globs(token.address)).x).to.equal(expandTo18Decimals(100));
      expect((await globs(token.address)).y).to.equal(expandTo18Decimals(25));
    });
    it('should revert when collecting zero', async () => {
      await expect(accumulator.collect(token.address, wallet.address, 0))
        .to.be.revertedWith('0');
      await expect(accumulator.collect(token.address, wallet.address, 1))
        .to.be.revertedWith('0');
    });
    it('should emit an event', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);
      await expect(accumulator.collect(token.address, wallet.address, expandTo18Decimals(100)))
        .to.emit(accumulator, 'Collected')
        .withArgs(wallet.address, token.address, wallet.address, expandTo18Decimals(100));
    });
  });
});
