import { use } from 'chai';
import { ethers, waffle } from 'hardhat';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';

import { deploy, snapshotGasCost } from './shared/utils';
import { Kernel } from '../typechain';

use(jestSnapshotPlugin());

const { loadFixture } = waffle;

describe('Kernel', async () => {
  let abi = new ethers.utils.AbiCoder();
  let wallet;
  let kernel: Kernel;

  const fixture = async () => {
    ;([wallet] = await ethers.getSigners());
    kernel = (await deploy('Kernel')) as Kernel;
  };

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe('#write', async () => {
    it('gas first write', async () => {
      const key = ethers.utils.keccak256(abi.encode(['address'], [wallet.address]));
      await snapshotGasCost(kernel.write(key, 1, 2));
    });
    it('gas write', async () => {
      const key = ethers.utils.keccak256(abi.encode(['address'], [wallet.address]));
      await kernel.write(key, 1, 2);
      await snapshotGasCost(kernel.write(key, 2, 3));
    });
  });

  describe('#update', async () => {
    it('gas update', async () => {
      const key = ethers.utils.keccak256(abi.encode(['address'], [wallet.address]));
      await kernel.write(key, 1, 1);
      await snapshotGasCost(kernel.update(key, 1, 1));
    });
  });
});
