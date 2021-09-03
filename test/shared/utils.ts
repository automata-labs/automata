import { expect } from 'chai';
import { ethers } from 'hardhat';

const { BigNumber } = ethers;
const { keccak256, toUtf8Bytes } = ethers.utils;

/**
 * Math
 */

export function expandTo18Decimals(n: number | string) {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

export function expandWithDecimals(n: number | string, decimals: number | string) {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(decimals));
}

/**
 * Constants
 */

export const MAX_UINT256 = BigNumber.from(2).pow(256).sub(1);
export const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1);
export const MAX_INT128 = BigNumber.from(2).pow(127).sub(1);

export const Q128 = BigNumber.from(2).pow(128);
export const TIMELOCK_DELAY = 60 * 60 * 24 * 2;
export const SECONDS_PER_YEAR = 31536000;
export const WETH = { address: '0x55560De96b4F5449E5f7613A36f7B9340E6527F9' };
export const WETH7 = { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' };
export const ROOT = ethers.utils.arrayify('0x00000000');

/**
 * Blockchain
 */

export async function mineBlock() {
  await advanceTimeAndBlock(15);
}

export async function mineBlocks(n: number) {
  for (let i = 0; i < n; i++) {
    await mineBlock();
  }
}

// Workaround for time travel tests bug: https://github.com/Tonyhaenn/hh-time-travel/blob/0161d993065a0b7585ec5a043af2eb4b654498b8/test/test.js#L12
export const advanceTimeAndBlock = async function (forwardTime: number) {
  const currentBlockNumber = await ethers.provider.getBlockNumber();
  const currentBlock = await ethers.provider.getBlock(currentBlockNumber);

  if (currentBlock === null) {
    // Workaround for https://github.com/nomiclabs/hardhat/issues/1183
    await ethers.provider.send('evm_increaseTime', [forwardTime]);
    await ethers.provider.send('evm_mine', []);
    // Set the next blocktime back to 15 seconds
    await ethers.provider.send('evm_increaseTime', [15]);
    return;
  }

  const currentTime = currentBlock.timestamp;
  const futureTime = currentTime + forwardTime;
  await ethers.provider.send('evm_setNextBlockTimestamp', [futureTime]);
  await ethers.provider.send('evm_mine', []);
};

export async function getCurrentBlock() {
  const currentBlockNumber = await ethers.provider.getBlockNumber();
  return ethers.provider.getBlock(currentBlockNumber);
}

export async function getCurrentTimestamp() {
  return (await getCurrentBlock()).timestamp;
}

/**
 * Miscellaenous
 */

export const key = (signature: string) => {
  return keccak256(toUtf8Bytes(signature));
};

export const signature = (signature: string) => {
  return keccak256(toUtf8Bytes(signature)).slice(0, 10);
};

export function verify(head, spec) {
  for (const [i, specSuite] of spec.suites.entries()) {
    const headSuite = head.suites[i] || {};
    expect(specSuite.title === headSuite.title, `Describe block mismatch '${specSuite.title}'`).to.be.true;

    if (specSuite.suites.length > 0) {
      verify(headSuite, specSuite);
    }

    for (const test of specSuite.tests) {
      expect(
        headSuite.tests.some(impl => impl.title === test.title),
        `Linking '${test.title}' with declaration '${headSuite.title}' failed`
      ).to.be.true;
    }

    for (const impl of headSuite.tests) {
      if (!specSuite.tests.some(test => test.title === impl.title)) {
        specSuite.tests.push(impl);
      }
    }
  }
}
