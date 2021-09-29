import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BabylonianTest } from '../typechain';
import { deploy } from './shared/utils';

const { BigNumber } = ethers;
const { MaxUint256 } = ethers.constants;

describe('Babylonian', () => {
  let wallet;

  let babylonian: BabylonianTest;

  before('deploy BabylonianTest', async () => {
    ;([wallet] = await ethers.getSigners());
    babylonian = (await deploy('BabylonianTest')) as BabylonianTest;
  })

  describe('#sqrt', () => {
    it('works for 0-99', async () => {
      for (let i = 0; i < 100; i++) {
        expect(await babylonian.sqrt(i)).to.eq(Math.floor(Math.sqrt(i)))
      }
    })

    it('product of numbers close to max uint112', async () => {
      const max = BigNumber.from(2).pow(112).sub(1)
      expect(await babylonian.sqrt(max.mul(max))).to.eq(max)
      const maxMinus1 = max.sub(1)
      expect(await babylonian.sqrt(maxMinus1.mul(maxMinus1))).to.eq(maxMinus1)
      const maxMinus2 = max.sub(2)
      expect(await babylonian.sqrt(maxMinus2.mul(maxMinus2))).to.eq(maxMinus2)

      expect(await babylonian.sqrt(max.mul(maxMinus1))).to.eq(maxMinus1)
      expect(await babylonian.sqrt(max.mul(maxMinus2))).to.eq(maxMinus2)
      expect(await babylonian.sqrt(maxMinus1.mul(maxMinus2))).to.eq(maxMinus2)
    })

    it('max uint256', async () => {
      const expected = BigNumber.from(2).pow(128).sub(1)
      expect(await babylonian.sqrt(MaxUint256)).to.eq(expected)
    });
  });
});