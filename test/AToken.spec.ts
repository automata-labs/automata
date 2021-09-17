import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { AToken, ERC20CompLike, Kernel, Operator, Sequencer } from '../typechain';
// @ts-ignore
import { SequencerFactory } from '../typechain/OperatorFactory.d.ts';
// @ts-ignore
import { OperatorFactory } from '../typechain/OperatorFactory.d.ts';
import { compLikeFixture } from './shared/fixtures';
import { operations } from './shared/functions';
import { expandTo18Decimals, MAX_UINT256, ROOT } from './shared/utils';

const { createFixtureLoader, provider } = waffle;

describe('AToken', async () => {
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

  let aToken: AToken;

  let virtualize: Function;
  let move: Function;
  let fetch: Function;

  const fixture = async () => {
    const Kernel = await ethers.getContractFactory('Kernel');
    const SequencerFactory = await ethers.getContractFactory('SequencerFactory');
    const OperatorFactory = await ethers.getContractFactory('OperatorFactory');
    const AToken = await ethers.getContractFactory('AToken');

    ;({ token } = await compLikeFixture(provider, wallet));
    kernel = (await Kernel.deploy()) as Kernel;
    sequencerFactory = (await SequencerFactory.deploy()) as SequencerFactory;
    operatorFactory = (await OperatorFactory.deploy(kernel.address)) as OperatorFactory;
    aToken = (await AToken.deploy(kernel.address, token.address, "AToken", "ATOK")) as AToken;

    await sequencerFactory.create(token.address);
    sequencer = (await ethers.getContractAt('Sequencer', await sequencerFactory.compute(token.address))) as Sequencer;

    await operatorFactory.create(token.address);
    operator = (await ethers.getContractAt('Operator', await operatorFactory.compute(token.address))) as Operator;

    // setup
    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, aToken.address);
    await sequencer.grantRole(ROOT, operator.address);

    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));

    ({ virtualize, move, fetch } = await operations({ token, kernel, operator }));
  };

  const mintFixture = async () => {
    await fixture();
  };

  const burnFixture = async () => {
    await fixture();
  };

  before('fixture loader', async () => {
    ;([wallet, other1, other2] = await ethers.getSigners());
    loadFixture = createFixtureLoader([wallet]);
  });

  describe('#mint', async () => {
    beforeEach(async () => {
      await loadFixture(mintFixture);
    });

    it('should mint', async () => {
      await virtualize(wallet, aToken.address, wallet.address, expandTo18Decimals(100));
      expect((await fetch(token.address, aToken.address)).x).to.equal(expandTo18Decimals(100));
      expect((await fetch(token.address, aToken.address)).y).to.equal(0);
      expect((await fetch(token.address, wallet.address)).x).to.equal(0);
      expect((await fetch(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));
      
      // mint
      expect(await aToken.balanceOf(wallet.address)).to.equal(0);
      await aToken.mint(wallet.address);
      expect(await aToken.totalSupply()).to.equal(expandTo18Decimals(100));
      expect(await aToken.balanceOf(wallet.address)).to.equal(expandTo18Decimals(100));

      // mint again to see nothing happens
      await aToken.mint(wallet.address);
      expect(await aToken.totalSupply()).to.equal(expandTo18Decimals(100));
      expect(await aToken.balanceOf(wallet.address)).to.equal(expandTo18Decimals(100));
    });
  });

  describe('#burn', async () => {
    beforeEach(async () => {
      await loadFixture(burnFixture);
    });

    it('should burn', async () => {
      // virtualize & mint
      await virtualize(wallet, aToken.address, wallet.address, expandTo18Decimals(100));
      await aToken.mint(wallet.address);
      expect(await aToken.totalSupply()).to.equal(expandTo18Decimals(100));
      expect(await aToken.balanceOf(wallet.address)).to.equal(expandTo18Decimals(100));

      // burn & virtualize
      await aToken.transfer(aToken.address, expandTo18Decimals(100));
      await aToken.burn(wallet.address);
      expect((await fetch(token.address, aToken.address)).x).to.equal(0);
      expect((await fetch(token.address, aToken.address)).y).to.equal(0);
      expect((await fetch(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await fetch(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));

      // realize
      await operator.transfer(operator.address, expandTo18Decimals(100), expandTo18Decimals(100));
      await operator.realize(other1.address);
      expect(await token.balanceOf(other1.address)).to.equal(expandTo18Decimals(100));
    });
  });
});
