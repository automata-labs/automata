import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { ERC20, Sequencer, SequencerFactory } from '../typechain';

const { createFixtureLoader } = waffle;

describe('SequencerFactory', async () => {
  let loadFixture;
  let wallet;

  let token0: ERC20;
  let token1: ERC20;

  let sequencerFactory: SequencerFactory;

  const fixture = async () => {
    const ERC20 = await ethers.getContractFactory('ERC20');
    const SequencerFactory = await ethers.getContractFactory('SequencerFactory');

    token0 = (await ERC20.deploy("Token0", "T0", 18)) as ERC20;
    token1 = (await ERC20.deploy("Token1", "T1", 18)) as ERC20;
    sequencerFactory = (await SequencerFactory.deploy()) as SequencerFactory;
  };

  before('fixture loader', async () => {
    ;([wallet] = await ethers.getSigners());
    loadFixture = createFixtureLoader([wallet]);
  });

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe('#create', async () => {
    it('should create', async () => {
      let sequencerAddress: string;
      let sequencer: Sequencer;

      await sequencerFactory.create(token0.address);
      sequencerAddress = await sequencerFactory.compute(token0.address);
      sequencer = (await ethers.getContractAt('Sequencer', sequencerAddress)) as Sequencer;
      expect(await sequencer.underlying()).to.equal(token0.address);
      expect(await sequencer.decimals()).to.equal(await token0.decimals());
      
      await sequencerFactory.create(token1.address);
      sequencerAddress = await sequencerFactory.compute(token1.address);
      sequencer = (await ethers.getContractAt('Sequencer', sequencerAddress)) as Sequencer;
      expect(await sequencer.underlying()).to.equal(token1.address);
      expect(await sequencer.decimals()).to.equal(await token1.decimals());
    });
    it('should revert when sequencer already deployed', async () => {
      await sequencerFactory.create(token0.address);
      await expect(sequencerFactory.create(token0.address)).to.be.reverted;
    });
    it('should revert on non-contract address', async () => {
      await expect(sequencerFactory.create(ethers.constants.AddressZero)).to.be.reverted;
      await expect(sequencerFactory.create(wallet.address)).to.be.reverted;
    });
  });
});
