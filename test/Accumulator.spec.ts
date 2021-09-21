import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { Accumulator, ERC20CompLike, Kernel, OperatorA, Sequencer } from '../typechain';
import { erc20CompLikeFixture } from './shared/fixtures';
import { deploy, expandTo18Decimals, MAX_UINT256, Q128, ROOT } from './shared/utils';

const { BigNumber } = ethers;
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

  const units = async (underlying: string, owner: string) => {
    return accumulator.units(ethers.utils.keccak256(abi.encode(['address', 'address'], [underlying, owner])));
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
      expect((await accumulator.get(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, wallet.address)).x128).to.equal(Q128);
    });
    it('should grow for multiple stakers', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);

      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, other1.address);
      await accumulator.grow(token.address);

      const x128 = (await accumulator.globs(token.address)).x128;
      expect((await accumulator.get(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, wallet.address)).y).to.equal(expandTo18Decimals(150));
      expect((await accumulator.get(token.address, wallet.address)).x128).to.equal(x128);
      expect((await accumulator.get(token.address, other1.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, other1.address)).y).to.equal(expandTo18Decimals(50));
      expect((await accumulator.get(token.address, other1.address)).x128).to.equal(x128);
    });
    it('should revert if growing when nothing staked', async () => {
      await join(wallet, wallet.address, accumulator.address, expandTo18Decimals(100));
      await expect(accumulator.grow(token.address)).to.be.reverted;
    });
  });

  describe('#stake', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should stake', async () => {
      await join(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      expect(await units(token.address, wallet.address)).to.eql([
        expandTo18Decimals(100),
        BigNumber.from(0),
        BigNumber.from(0)
      ]);
    });
    it('should stake to another account', async () => {
      await join(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, other1.address);
      expect(await units(token.address, other1.address)).to.eql([
        expandTo18Decimals(100),
        BigNumber.from(0),
        BigNumber.from(0)
      ]);
    });
    it.skip('should stake when x128 is non-zero');
    it('should stake to non-contract token address', async () => {
      await accumulator.stake(wallet.address, other1.address);
      expect(await units(wallet.address, other1.address)).to.eql([
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0)
      ]);
    });
  });

  describe('#unstake', async () => {
    it('should unstake', async () => {
      await join(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);

      expect(await units(token.address, wallet.address)).to.eql([
        expandTo18Decimals(100),
        BigNumber.from(0),
        BigNumber.from(0),
      ]);
      await accumulator.unstake(token.address, wallet.address, expandTo18Decimals(100));
      expect(await units(token.address, wallet.address)).to.eql([
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0),
      ]);
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
      expect((await accumulator.globs(token.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.globs(token.address)).y).to.equal(0);
      expect((await accumulator.get(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, wallet.address)).y).to.equal(0);
      expect((await read(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));
      expect((await read(token.address, accumulator.address)).y).to.equal(0);
    });
    it('should collect partially', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);
      await accumulator.collect(token.address, wallet.address, expandTo18Decimals(75));
      expect((await accumulator.globs(token.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.globs(token.address)).y).to.equal(expandTo18Decimals(25));
      expect((await accumulator.get(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, wallet.address)).y).to.equal(expandTo18Decimals(25));
      expect((await read(token.address, wallet.address)).x).to.equal(0);
      expect((await read(token.address, wallet.address)).y).to.equal(expandTo18Decimals(75));
      expect((await read(token.address, accumulator.address)).x).to.equal(expandTo18Decimals(100));
      expect((await read(token.address, accumulator.address)).y).to.equal(expandTo18Decimals(25));
    });
  });
});
