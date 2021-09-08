import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { Accumulator, ERC20CompLike, Kernel, Operator, OperatorFactory, Sequencer, SequencerFactory } from '../typechain';
import { operations } from './shared/functions';
import { bytes32, expandTo18Decimals, MAX_UINT256, Q128, ROOT } from './shared/utils';

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
  let sequencerFactory: SequencerFactory;
  let operatorFactory: OperatorFactory;
  let sequencer: Sequencer;
  let operator: Operator;
  let accumulator: Accumulator;

  let virtualize: Function;
  let fetch: Function;
  let getState: Function;

  const fixture = async () => {
    const ERC20CompLike = await ethers.getContractFactory('ERC20CompLike');
    const Kernel = await ethers.getContractFactory('Kernel');
    const SequencerFactory = await ethers.getContractFactory('SequencerFactory');
    const OperatorFactory = await ethers.getContractFactory('OperatorFactory');
    const Accumulator = await ethers.getContractFactory('Accumulator');

    const timestamp = (await provider.getBlock('latest')).timestamp;
    token = (await ERC20CompLike.deploy(wallet.address, wallet.address, timestamp + 60 * 60)) as ERC20CompLike;
    kernel = (await Kernel.deploy()) as Kernel;
    sequencerFactory = (await SequencerFactory.deploy()) as SequencerFactory;
    operatorFactory = (await OperatorFactory.deploy(kernel.address)) as OperatorFactory;
    accumulator = (await Accumulator.deploy(kernel.address)) as Accumulator;

    await sequencerFactory.create(token.address);
    sequencer = (await ethers.getContractAt('Sequencer', await sequencerFactory.compute(token.address))) as Sequencer;

    await operatorFactory.create(token.address);
    operator = (await ethers.getContractAt('Operator', await operatorFactory.compute(token.address))) as Operator;

    // setup
    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, accumulator.address);
    await sequencer.grantRole(ROOT, operator.address);

    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);
    await operator.set(bytes32('sequencer'), abi.encode(['address'], [sequencer.address]));

    ({ virtualize, fetch, getState } = await operations({ token, kernel, operator, accumulator }));
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
      await virtualize(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);
      expect((await accumulator.get(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, wallet.address)).x128).to.equal(Q128);
    });
    it('should grow for multiple stakers', async () => {
      await virtualize(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);

      await virtualize(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, other1.address);
      await accumulator.grow(token.address);

      const x128 = (await accumulator.accumulators(token.address)).x128;
      expect((await accumulator.get(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, wallet.address)).y).to.equal(expandTo18Decimals(150));
      expect((await accumulator.get(token.address, wallet.address)).x128).to.equal(x128);
      expect((await accumulator.get(token.address, other1.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, other1.address)).y).to.equal(expandTo18Decimals(50));
      expect((await accumulator.get(token.address, other1.address)).x128).to.equal(x128);
    });
    it('should revert if growing when nothing staked', async () => {
      await virtualize(wallet, wallet.address, accumulator.address, expandTo18Decimals(100));
      await expect(accumulator.grow(token.address)).to.be.reverted;
    });
  });

  describe('#stake', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should stake', async () => {
      await virtualize(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      expect(await getState(token.address, wallet.address)).to.eql([
        expandTo18Decimals(100),
        BigNumber.from(0),
        BigNumber.from(0)
      ]);
    });
    it('should stake to another account', async () => {
      await virtualize(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, other1.address);
      expect(await getState(token.address, other1.address)).to.eql([
        expandTo18Decimals(100),
        BigNumber.from(0),
        BigNumber.from(0)
      ]);
    });
    it.skip('should stake when x128 is non-zero');
    it('should stake to non-contract token address', async () => {
      await accumulator.stake(wallet.address, other1.address);
      expect(await getState(wallet.address, other1.address)).to.eql([
        BigNumber.from(0),
        BigNumber.from(0),
        BigNumber.from(0)
      ]);
    });
  });

  describe('#unstake', async () => {
    it('should unstake', async () => {
      await virtualize(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);

      expect(await getState(token.address, wallet.address)).to.eql([
        expandTo18Decimals(100),
        BigNumber.from(0),
        BigNumber.from(0),
      ]);
      await accumulator.unstake(token.address, wallet.address, expandTo18Decimals(100));
      expect(await getState(token.address, wallet.address)).to.eql([
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
      await virtualize(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);
      await accumulator.collect(token.address, wallet.address, expandTo18Decimals(100));
      expect((await accumulator.accumulators(token.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.accumulators(token.address)).y).to.equal(0);
      expect((await accumulator.get(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, wallet.address)).y).to.equal(0);
      expect((await fetch(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));
      expect((await fetch(token.address, accumulator.address)).y).to.equal(0);
    });
    it('should collect partially', async () => {
      await virtualize(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await accumulator.grow(token.address);
      await accumulator.collect(token.address, wallet.address, expandTo18Decimals(75));
      expect((await accumulator.accumulators(token.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.accumulators(token.address)).y).to.equal(expandTo18Decimals(25));
      expect((await accumulator.get(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await accumulator.get(token.address, wallet.address)).y).to.equal(expandTo18Decimals(25));
      expect((await fetch(token.address, wallet.address)).x).to.equal(0);
      expect((await fetch(token.address, wallet.address)).y).to.equal(expandTo18Decimals(75));
      expect((await fetch(token.address, accumulator.address)).x).to.equal(expandTo18Decimals(100));
      expect((await fetch(token.address, accumulator.address)).y).to.equal(expandTo18Decimals(25));
    });
  });
});
