import { expect, use } from 'chai';
import { ethers, waffle } from 'hardhat';
import { solidity } from 'ethereum-waffle';

import { Executable, Shard, ShardMock } from '../typechain';
import { deploy } from './shared/utils';

const { createFixtureLoader } = waffle;

use(solidity);

describe('Shard', async () => {
  let loadFixture;

  let wallet;
  let other1;

  let shard: Shard;
  let shardMock: ShardMock;
  let executable: Executable;

  const fixture = async () => {
    shard = (await deploy('Shard')) as Shard;
    executable = (await deploy('Executable')) as Executable;
    shardMock = (await deploy('ShardMock', shard.address, executable.address)) as ShardMock;

    await shard.grantRole('0x00000000', shardMock.address);
  };

  before('fixture loader', async () => {
    ;([wallet, other1] = await ethers.getSigners());
    loadFixture = createFixtureLoader([wallet]);
  });

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe('#initialize', async () => {
    it('should initialize', async () => {
      expect(await shard.hasRole('0x00000000', other1.address)).to.be.false;
      await shard.connect(other1).initialize();
      expect(await shard.hasRole('0x00000000', other1.address)).to.be.true;
    });
    it('should revert when initialized twice', async () => {
      await shard.connect(other1).initialize();
      expect(shard.connect(other1).initialize()).to.be.revertedWith('Initializable: contract is already initialized');
    });
    it('should emit an event', async () => {
      await expect(shard.initialize()).to.emit(shard, 'Initialized');
    });
  });

  describe('#execute', async () => {
    it('should execute function without arguments', async () => {
      await shardMock.functionWithoutArguments();
      expect(await executable.value0()).to.equal(1);
    });
    it('should execute function with one argument', async () => {
      await shardMock.functionWithOneArgument();
      expect(await executable.value0()).to.equal(42);
    });
    it('should execute function with multiple arguments', async () => {
      await shardMock.functionWithMultipleArugments();
      expect(await executable.value0()).to.equal(42);
      expect(await executable.value1()).to.equal(wallet.address);
    });
    it('should execute function with multiple arguments and return value', async () => {
      await shardMock.functionWithMultipleArugmentsAndResults();
      expect(await executable.value0()).to.equal(42);
      expect(await executable.value1()).to.equal(wallet.address);
    });
    it('should revert if no access', async () => {
      const targets = [executable.address];
      const data = [executable.interface.encodeFunctionData('functionWithoutArguments')];
      await expect(shard.connect(other1).execute(targets, data))
        .to.be.revertedWith('Access denied');
    });
  });
});
