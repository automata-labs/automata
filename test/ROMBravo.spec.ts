import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { Accumulator, ROMBravo, ERC20CompLike, GovernorBravoMock, Kernel, Linear, Operator, OperatorFactory, Sequencer, SequencerFactory, Timelock } from '../typechain';
import { compLikeFixture, governorBravoFixture } from './shared/fixtures';
import { operations } from './shared/functions';
import { expandTo18Decimals, MAX_UINT256, mineBlocks, ROOT } from './shared/utils';

const { createFixtureLoader, provider } = waffle;

describe('ROMBravo', async () => {
  let abi = new ethers.utils.AbiCoder();
  let loadFixture;
  let wallet;
  let other1;

  let token: ERC20CompLike;
  let governor: GovernorBravoMock;

  let kernel: Kernel;
  let sequencerFactory: SequencerFactory;
  let operatorFactory: OperatorFactory;
  let sequencer: Sequencer;
  let operator: Operator;
  let accumulator: Accumulator;

  let linear: Linear;
  let emulator: ROMBravo;
  let rom: ROMBravo;

  let virtualize: Function;

  const fixture = async () => {
    const Kernel = await ethers.getContractFactory('Kernel');
    const SequencerFactory = await ethers.getContractFactory('SequencerFactory');
    const OperatorFactory = await ethers.getContractFactory('OperatorFactory');
    const Accumulator = await ethers.getContractFactory('Accumulator');
    const Linear = await ethers.getContractFactory('Linear');
    const ROMBravo = await ethers.getContractFactory('ROMBravo');
    const Emulator = await ethers.getContractFactory('Emulator');

    ;({ token } = await compLikeFixture(provider, wallet));
    ;({ governor } = await governorBravoFixture(provider, token, wallet));

    kernel = (await Kernel.deploy()) as Kernel;
    sequencerFactory = (await SequencerFactory.deploy()) as SequencerFactory;
    operatorFactory = (await OperatorFactory.deploy(kernel.address)) as OperatorFactory;
    accumulator = (await Accumulator.deploy(kernel.address)) as Accumulator;

    linear = (await Linear.deploy()) as Linear;
    rom = (await ROMBravo.deploy()) as ROMBravo;
    const emulatorAddress = (await Emulator.deploy(rom.address, [], token.address)).address;
    emulator = (await ethers.getContractAt('ROMBravo', emulatorAddress)) as ROMBravo;

    await sequencerFactory.create(token.address);
    sequencer = (await ethers.getContractAt('Sequencer', await sequencerFactory.compute(token.address))) as Sequencer;

    await operatorFactory.create(token.address);
    operator = (await ethers.getContractAt('Operator', await operatorFactory.compute(token.address))) as Operator;

    // setup
    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, accumulator.address);
    await sequencer.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, emulator.address);
    
    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governor.address]));
    await emulator.set(emulator.interface.getSighash('accumulator'), abi.encode(['address'], [accumulator.address]));
    await emulator.set(emulator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await emulator.set(emulator.interface.getSighash('governor'), abi.encode(['address'], [governor.address]));
    await emulator.set(emulator.interface.getSighash('period'), abi.encode(['uint32'], [80]));
    await emulator.set(emulator.interface.getSighash('computer'), abi.encode(['address'], [linear.address]));

    await governor['_initiate()']();

    ({ virtualize } = await operations({ token, kernel, operator, accumulator }));
  };

  const propose = async () => {
    await token.delegate(wallet.address);
    await governor.propose(
      [token.address],
      [0],
      ['mint(address,uint256)'],
      [abi.encode(['address', 'uint256'], [other1.address, expandTo18Decimals(100)])],
      `Mint to ${other1.address}`
    );
  };

  before('fixture loader', async () => {
    ;([wallet, other1] = await ethers.getSigners());
    loadFixture = createFixtureLoader([wallet], provider);
  });

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe('#sum', async () => {
    it('should sum', async () => {
      await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(100));
      await operator.transfer(accumulator.address, expandTo18Decimals(100), 0);
      await accumulator.stake(token.address, wallet.address);
      
      await propose();
      
      await operator.transfer(accumulator.address, 0, expandTo18Decimals(100));
      await emulator.choice(2, 1);
      expect((await emulator.votes(2)).x).to.equal(expandTo18Decimals(100));
      expect((await emulator.votes(2)).y).to.equal(0);
    });
    it('should revert when nothing staked', async () => {
      await expect(emulator.choice(2, 1)).to.be.reverted;
    })
    it('should revert when proposal is not created', async () => {
      await virtualize(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await expect(emulator.choice(2, 1)).to.be.revertedWith('E');
    });
    it('should revert when summing zero', async () => {
      await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(100));
      await operator.transfer(accumulator.address, expandTo18Decimals(100), 0);
      await accumulator.stake(token.address, wallet.address);
      
      await propose();
      
      await expect(emulator.choice(2, 1)).to.be.revertedWith('0');
    });
  });

  describe('#vote', async () => {
    it('should vote with all (100)', async () => {
      await virtualize(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await propose();
      await emulator.choice(2, 1);

      await mineBlocks(
        provider,
        (await emulator.timeline(2))[2].toNumber() - (await provider.getBlockNumber())
      );

      await expect(emulator.trigger(2, 10)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 9)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 8)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 7)).to.be.revertedWith('F0');
      await emulator.trigger(2, 6);
      await emulator.trigger(2, 5);
      await emulator.trigger(2, 4);
      await emulator.trigger(2, 3);
      await emulator.trigger(2, 2);
      await emulator.trigger(2, 1);
      await emulator.trigger(2, 0);
    });
    it('should vote with all (75)', async () => {
      // vote with 75, with excess of 12.
      // we allow vote with cursor, and then we have 63 left.
      await virtualize(wallet, accumulator.address, accumulator.address, expandTo18Decimals(75));
      await accumulator.stake(token.address, wallet.address);
      await propose();
      await emulator.choice(2, 1);

      await mineBlocks(
        provider,
        (await emulator.timeline(2))[2].toNumber() - (await provider.getBlockNumber())
      );

      await expect(emulator.trigger(2, 10)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 9)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 8)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 7)).to.be.revertedWith('F0');
      await emulator.trigger(2, 6);
      await emulator.trigger(2, 5);
      await emulator.trigger(2, 4);
      await emulator.trigger(2, 3);
      await emulator.trigger(2, 2);
      await emulator.trigger(2, 1);
      await emulator.trigger(2, 0);
    });
    it('should vote with all (38)', async () => {
      await virtualize(wallet, accumulator.address, accumulator.address, expandTo18Decimals(38));
      await accumulator.stake(token.address, wallet.address);
      await propose();
      await emulator.choice(2, 1);

      await mineBlocks(
        provider,
        (await emulator.timeline(2))[2].toNumber() - (await provider.getBlockNumber())
      );

      await expect(emulator.trigger(2, 10)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 9)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 8)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 7)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 6)).to.be.revertedWith('F0');
      await emulator.trigger(2, 5);
      await emulator.trigger(2, 4);
      await emulator.trigger(2, 3);
      await emulator.trigger(2, 2);
      await emulator.trigger(2, 1);
      await emulator.trigger(2, 0);
    });
    it('should vote with 75 out of 100', async () => {
      await virtualize(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await propose();
      await operator.transfer(accumulator.address, 0, expandTo18Decimals(75));
      await emulator.choice(2, 1);

      await mineBlocks(
        provider,
        (await emulator.timeline(2))[2].toNumber() - (await provider.getBlockNumber())
      );

      await expect(emulator.trigger(2, 10)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 9)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 8)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 7)).to.be.revertedWith('F0');
      await emulator.trigger(2, 6);
      await emulator.trigger(2, 5);
      await expect(emulator.trigger(2, 4)).to.be.revertedWith('F0');
      await expect(emulator.trigger(2, 3)).to.be.revertedWith('F0');
      await emulator.trigger(2, 2)
      await emulator.trigger(2, 1);
      await expect(emulator.trigger(2, 0)).to.be.revertedWith('F0');
    });
  });
});
