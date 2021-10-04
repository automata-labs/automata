import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { deploy, expandTo18Decimals } from './shared/utils';
import { CursorMock } from '../typechain';
import { BigNumber } from '@ethersproject/bignumber';

const { loadFixture } = waffle;

describe('Cursor', async () => {
  let wallet;

  let decimals = 18;
  let cursor: CursorMock;

  const fixture = async () => {
    ;([wallet] = await ethers.getSigners());
    cursor = (await deploy('CursorMock')) as CursorMock;
  };

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe('#getCursor', async () => {
    it('0 => 0', async () => {
      expect(await cursor.getCursor(0, decimals)).to.equal(0);
    });
    it('1 => 0', async () => {
      expect(await cursor.getCursor(1, decimals)).to.equal(0);
    });
    it('1e18 - 1 => 0', async () => {
      expect(await cursor.getCursor(expandTo18Decimals(1).sub(1), decimals)).to.equal(0);
    });
    it('1e18 => 0', async () => {
      expect(await cursor.getCursor(expandTo18Decimals(1), decimals)).to.equal(0);
    });
    it('1e18 + 1 => 1', async () => {
      expect(await cursor.getCursor(expandTo18Decimals(1).add(1), decimals)).to.equal(1);
    });
    it('63e18 - 1 => 5', async () => {
      expect(await cursor.getCursor(expandTo18Decimals(63).sub(1), decimals)).to.equal(5);
    });
    it('63e18 => 5', async () => {
      expect(await cursor.getCursor(expandTo18Decimals(63), decimals)).to.equal(5);
    });
    it('63e18 + 1 => 6', async () => {
      expect(await cursor.getCursor(expandTo18Decimals(63).add(1), decimals)).to.equal(6);
    });
    it('(2^128 - 1)e18 - 1 => 128', async () => {
      const n = BigNumber.from(2).pow(128).sub(1).toString();
      expect(await cursor.getCursor(expandTo18Decimals(n).sub(1), decimals)).to.equal(127);
    });
    it('(2^128 - 1)e18 => 128', async () => {
      const n = BigNumber.from(2).pow(128).sub(1).toString();
      expect(await cursor.getCursor(expandTo18Decimals(n), decimals)).to.equal(127);
    });
    it('(2^128 - 1)e18 + 1 => 6', async () => {
      const n = BigNumber.from(2).pow(128).sub(1).toString();
      expect(await cursor.getCursor(expandTo18Decimals(n).add(1), decimals)).to.equal(128);
    });
  });

  describe('getCursorRoundingUp', async () => {
    it('0 => 0', async () => {
      expect(await cursor.getCursorRoundingUp(0, decimals)).to.equal(0);
    });
    it('1 => 0', async () => {
      expect(await cursor.getCursorRoundingUp(1, decimals)).to.equal(0);
    });
    it('1e18 - 1 => 0', async () => {
      expect(await cursor.getCursorRoundingUp(expandTo18Decimals(1).sub(1), decimals)).to.equal(0);
    });
    it('1e18 => 0', async () => {
      expect(await cursor.getCursorRoundingUp(expandTo18Decimals(1), decimals)).to.equal(1);
    });
    it('1e18 + 1 => 1', async () => {
      expect(await cursor.getCursorRoundingUp(expandTo18Decimals(1).add(1), decimals)).to.equal(1);
    });
    it('63e18 - 1 => 5', async () => {
      expect(await cursor.getCursorRoundingUp(expandTo18Decimals(63).sub(1), decimals)).to.equal(5);
    });
    it('63e18 => 5', async () => {
      expect(await cursor.getCursorRoundingUp(expandTo18Decimals(63), decimals)).to.equal(6);
    });
    it('63e18 + 1 => 6', async () => {
      expect(await cursor.getCursorRoundingUp(expandTo18Decimals(63).add(1), decimals)).to.equal(6);
    });
    it('(2^128 - 1)e18 - 1 => 128', async () => {
      const n = BigNumber.from(2).pow(128).sub(1).toString();
      expect(await cursor.getCursorRoundingUp(expandTo18Decimals(n).sub(1), decimals)).to.equal(127);
    });
    it('(2^128 - 1)e18 => 128', async () => {
      const n = BigNumber.from(2).pow(128).sub(1).toString();
      expect(await cursor.getCursorRoundingUp(expandTo18Decimals(n), decimals)).to.equal(128);
    });
    it('(2^128 - 1)e18 + 1 => 6', async () => {
      const n = BigNumber.from(2).pow(128).sub(1).toString();
      expect(await cursor.getCursorRoundingUp(expandTo18Decimals(n).add(1), decimals)).to.equal(128);
    });
  });
});
