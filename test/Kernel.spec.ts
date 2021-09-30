import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { deploy, MaxUint128 } from './shared/utils';
import { Kernel } from '../typechain';

const { BigNumber } = ethers;
const { loadFixture } = waffle;

describe('Kernel', async () => {
  let abi = new ethers.utils.AbiCoder();
  let wallet;
  let other1;
  let other2;

  let kernel: Kernel;

  const fixture = async () => {
    ;([wallet, other1, other2] = await ethers.getSigners());
    kernel = (await deploy('Kernel')) as Kernel;
  };

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  function code(address) {
    return ethers.utils.keccak256(abi.encode(['address'], [address]));
  }

  describe('#write', async () => {
    it('should write', async () => {
      const key = ethers.utils.keccak256(abi.encode(['address'], [wallet.address]));
      await kernel.write(key, 50, 100);
      expect((await kernel.read(key)).x).to.equal(50);
      expect((await kernel.read(key)).y).to.equal(100);
    });
    it('should write max', async () => {
      const key = ethers.utils.keccak256(abi.encode(['address'], [wallet.address]));
      await kernel.write(key, MaxUint128, MaxUint128);
      expect((await kernel.read(key)).x).to.equal(MaxUint128);
      expect((await kernel.read(key)).y).to.equal(MaxUint128);
    });
    it('should write to zero', async () => {
      const key = ethers.utils.keccak256(abi.encode(['address'], [wallet.address]));
      await kernel.write(key, MaxUint128, MaxUint128);
      await kernel.write(key, 0, 0);
      expect((await kernel.read(key)).x).to.equal(0);
      expect((await kernel.read(key)).y).to.equal(0);
    });
    it('should emit an event', async () => {
      const key = ethers.utils.keccak256(abi.encode(['address'], [wallet.address]));
      await expect(kernel.write(key, 1, 3))
        .to.emit(kernel, 'Written').withArgs(wallet.address, key, 1, 3);
    });
    it('should revert when no access', async () => {
      const key = ethers.utils.keccak256(abi.encode(['address'], [wallet.address]));
      await expect(kernel.write(key, 0, 0));
    });
  });

  describe('#update', async () => {
    let key;

    before(() => {
      key = ethers.utils.keccak256(abi.encode(['address'], [wallet.address]))
    });
  
    it('(1, 2) + (0, 0)', async () => {
      await kernel.write(key, 1, 2);
      await kernel.update(key, 0, 0);
      expect((await kernel.read(key)).x).to.equal(1);
      expect((await kernel.read(key)).y).to.equal(2);
    });
    it('(1, 2) + (0, -1)', async () => {
      await kernel.write(key, 1, 2);
      await kernel.update(key, 0, -1);
      expect((await kernel.read(key)).x).to.equal(1);
      expect((await kernel.read(key)).y).to.equal(1);
    });
    it('(1, 2) + (-1, 0)', async () => {
      await kernel.write(key, 1, 2);
      await kernel.update(key, -1, 0);
      expect((await kernel.read(key)).x).to.equal(0);
      expect((await kernel.read(key)).y).to.equal(2);
    });
    it('(1, 2) + (-1, -2)', async () => {
      await kernel.write(key, 1, 2);
      await kernel.update(key, -1, -2);
      expect((await kernel.read(key)).x).to.equal(0);
      expect((await kernel.read(key)).y).to.equal(0);
    });
    it('(1, 2) + (1, 2)', async () => {
      await kernel.write(key, 1, 2);
      await kernel.update(key, 1, 2);
      expect((await kernel.read(key)).x).to.equal(2);
      expect((await kernel.read(key)).y).to.equal(4);
    });
    it('(2**128 - 13, 0) + (13, 0) overflows', async () => {
      await kernel.write(key, BigNumber.from(2).pow(128).sub(13), 0);
      await expect(kernel.update(key, 13, 0)).to.be.revertedWith('0x11');
    });
    it('(0, 2**128 - 13) + (0, 13) overflows', async () => {
      await kernel.write(key, 0, BigNumber.from(2).pow(128).sub(13));
      await expect(kernel.update(key, 0, 13)).to.be.revertedWith('0x11');
    });
    it('(0, 0) + (-1, 0) underflows', async () => {
      await expect(kernel.update(key, -1, 0)).to.be.revertedWith('-');
    });
    it('(0, 0) + (0, -1) underflows', async () => {
      await expect(kernel.update(key, 0, -1)).to.be.revertedWith('-');
    });
    it('(3, 0) + (-4, 0) underflows', async () => {
      await kernel.write(key, 3, 0);
      await expect(kernel.update(key, -4, 0)).to.be.revertedWith('-');
    });
    it('(0, 3) + (0, -4) underflows', async () => {
      await kernel.write(key, 0, 3);
      await expect(kernel.update(key, 0, -4)).to.be.revertedWith('-');
    });
    it('(3, 3) + (-4, -4) underflows', async () => {
      await kernel.write(key, 3, 3);
      await expect(kernel.update(key, -4, -4)).to.be.revertedWith('-');
    });
    it('should emit an event', async () => {
      await expect(kernel.update(key, 1, 2))
        .to.emit(kernel, 'Updated').withArgs(wallet.address, key, 1, 2);
    });
  });

  describe('transfer', async () => {
    let from;
    let to;

    before(() => {
      from = code(wallet.address);
      to = code(other1.address);
    });

    // (from_before, to_before) => (from_after, to_after)
    it('((0, 0), (0, 0)) * (0, 0)', async () => {
      await kernel.transfer(from, to, 0, 0);
      expect((await kernel.read(from)).x).to.equal(0);
      expect((await kernel.read(from)).y).to.equal(0);
      expect((await kernel.read(to)).x).to.equal(0);
      expect((await kernel.read(to)).y).to.equal(0);
    });
    it('((1, 2), (3, 4)) * (0, 0)', async () => {
      await kernel.write(from, 1, 2);
      await kernel.write(to, 3, 4);
      await kernel.transfer(from, to, 0, 0);
      expect((await kernel.read(from)).x).to.equal(1);
      expect((await kernel.read(from)).y).to.equal(2);
      expect((await kernel.read(to)).x).to.equal(3);
      expect((await kernel.read(to)).y).to.equal(4);
    });
    it('((1, 0), (0, 0)) * (1, 0)', async () => {
      await kernel.write(from, 1, 0);
      await kernel.transfer(from, to, 1, 0);
      expect((await kernel.read(from)).x).to.equal(0);
      expect((await kernel.read(from)).y).to.equal(0);
      expect((await kernel.read(to)).x).to.equal(1);
      expect((await kernel.read(to)).y).to.equal(0);
    });
    it('((0, 1), (0, 0)) * (1, 0)', async () => {
      await kernel.write(from, 0, 1);
      await kernel.transfer(from, to, 0, 1);
      expect((await kernel.read(from)).x).to.equal(0);
      expect((await kernel.read(from)).y).to.equal(0);
      expect((await kernel.read(to)).x).to.equal(0);
      expect((await kernel.read(to)).y).to.equal(1);
    });
    it('((1, 1), (0, 0)) * (1, 1)', async () => {
      await kernel.write(from, 1, 1);
      await kernel.transfer(from, to, 1, 1);
      expect((await kernel.read(from)).x).to.equal(0);
      expect((await kernel.read(from)).y).to.equal(0);
      expect((await kernel.read(to)).x).to.equal(1);
      expect((await kernel.read(to)).y).to.equal(1);
    });
    it('((1, 5), (0, 0)) * (1, 3)', async () => {
      await kernel.write(from, 1, 5);
      await kernel.transfer(from, to, 1, 3);
      expect((await kernel.read(from)).x).to.equal(0);
      expect((await kernel.read(from)).y).to.equal(2);
      expect((await kernel.read(to)).x).to.equal(1);
      expect((await kernel.read(to)).y).to.equal(3);
    });
    it('((10, 11), (12, 13)) * (4, 5)', async () => {
      await kernel.write(from, 10, 11);
      await kernel.write(to, 12, 13);
      await kernel.transfer(from, to, 4, 5);
      expect((await kernel.read(from)).x).to.equal(6);
      expect((await kernel.read(from)).y).to.equal(6);
      expect((await kernel.read(to)).x).to.equal(16);
      expect((await kernel.read(to)).y).to.equal(18);
    });
    it('((13, 0), (2**128 - 13, 0)) * (13, 0) overflows', async () => {
      await kernel.write(from, 13, 0);
      await kernel.write(to, BigNumber.from(2).pow(128).sub(13), 0);
      await expect(kernel.transfer(from, to, 13, 0)).to.be.revertedWith('0x11');
    });
    it('((0, 13), (0, 2**128 - 13)) * (0, 13) overflows', async () => {
      await kernel.write(from, 0, 13);
      await kernel.write(to, 0, BigNumber.from(2).pow(128).sub(13));
      await expect(kernel.transfer(from, to, 0, 13)).to.be.revertedWith('0x11');
    });
    it('((0, 0), (0, 0)) * (1, 0) underflows', async () => {
      await expect(kernel.transfer(from, to, 1, 0)).to.be.revertedWith('-');
    });
    it('((0, 0), (0, 0)) * (0, 1) underflows', async () => {
      await expect(kernel.transfer(from, to, 0, 1)).to.be.revertedWith('-');
    });
    it('((3, 0), (0, 0)) * (4, 0) underflows', async () => {
      await kernel.write(from, 3, 0);
      await expect(kernel.transfer(from, to, 4, 0)).to.be.revertedWith('-');
    });
    it('((0, 3), (0, 0)) * (0, 4) underflows', async () => {
      await kernel.write(from, 0, 3);
      await expect(kernel.transfer(from, to, 0, 4)).to.be.revertedWith('-');
    });
    it('should emit an event', async () => {
      await kernel.write(from, 10, 11);
      await kernel.write(from, 12, 13);
      await expect(kernel.transfer(from, to, 4, 5))
        .to.emit(kernel, 'Transferred').withArgs(wallet.address, from, to, 4, 5);
    });
  });
});
