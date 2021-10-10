import { TransactionReceipt, TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { constants, Contract, BigNumber, BigNumberish, ContractTransaction, utils, Wallet } from 'ethers';
import { ethers } from 'hardhat';

import { ERC20CompLike, ERC20Permit } from '../../typechain';

const { keccak256, splitSignature, toUtf8Bytes } = utils;

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

export const MaxUint128 = BigNumber.from(2).pow(128).sub(1);
export const Q128 = BigNumber.from(2).pow(128);
export const ROOT = ethers.utils.arrayify('0x00000000');
export const TIMELOCK_DELAY = 60 * 60 * 24 * 2;

/**
 * Blockchain
 */

export async function evmBlockNumber(provider) {
  return Number.parseInt(await provider.send('eth_blockNumber', []), 16);
}

export async function evmMine(provider) {
  await provider.send('evm_increaseTime', [15]);
  await provider.send('evm_mine', []);
}

export async function evmMiner(provider, n: number) {
  for (let i = 0; i < n; i++) {
    await evmMine(provider);
  }
}

// Workaround for time travel tests bug: https://github.com/Tonyhaenn/hh-time-travel/blob/0161d993065a0b7585ec5a043af2eb4b654498b8/test/test.js#L12
export async function evmMineToFuture(provider, future: number) {
  const currentBlockNumber = await provider.getBlockNumber();
  const currentBlock = await provider.getBlock(currentBlockNumber);

  if (currentBlock === null) {
    // Workaround for https://github.com/nomiclabs/hardhat/issues/1183
    await provider.send('evm_increaseTime', [future]);
    await provider.send('evm_mine', []);
    // Set the next blocktime back to 15 seconds
    await provider.send('evm_increaseTime', [15]);
    return;
  }

  const currentTime = currentBlock.timestamp;
  const futureTime = currentTime + future;
  await provider.send('evm_setNextBlockTimestamp', [futureTime]);
  await provider.send('evm_mine', []);
}

/**
 * Miscellaenous
 */

export const bytes32 = (text: string) => {
  return ethers.utils.formatBytes32String(text);
};

export const key = (signature: string) => {
  return keccak256(toUtf8Bytes(signature));
};

export const signature = (signature: string) => {
  return keccak256(toUtf8Bytes(signature)).slice(0, 10);
};

export async function deploy(name: string, ...args) {
  return (await ethers.getContractFactory(name)).deploy(...args);
}

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

/**
 * Snapshot
 */

export async function snapshotGasCost(
  x:
    | TransactionResponse
    | Promise<TransactionResponse>
    | ContractTransaction
    | Promise<ContractTransaction>
    | TransactionReceipt
    | Promise<BigNumber>
    | BigNumber
    | Contract
    | Promise<Contract>
): Promise<void> {
  const resolved = await x;
  if ('deployTransaction' in resolved) {
    const receipt = await resolved.deployTransaction.wait();
    expect(receipt.gasUsed.toNumber()).toMatchSnapshot();
  } else if ('wait' in resolved) {
    const waited = await resolved.wait();
    expect(waited.gasUsed.toNumber()).toMatchSnapshot();
  } else if (BigNumber.isBigNumber(resolved)) {
    expect(resolved.toNumber()).toMatchSnapshot();
  }
}

/**
 * Permit
 */

export async function getPermitSignatureWithoutVersion(
  wallet: Wallet,
  token: ERC20Permit | ERC20CompLike,
  spender: string,
  value: BigNumberish = constants.MaxUint256,
  deadline = constants.MaxUint256,
  permitConfig?: { nonce?: BigNumberish; name?: string; chainId?: number; }
) {
  const [nonce, name, chainId] = await Promise.all([
    permitConfig?.nonce ?? token.nonces(wallet.address),
    permitConfig?.name ?? token.name(),
    permitConfig?.chainId ?? wallet.getChainId(),
  ])

  return splitSignature(
    await wallet._signTypedData(
      {
        name,
        chainId,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: wallet.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  )
}

export async function getPermitSignature(
  wallet: Wallet,
  token: ERC20Permit | ERC20CompLike,
  spender: string,
  value: BigNumberish = constants.MaxUint256,
  deadline = constants.MaxUint256,
  permitConfig?: { nonce?: BigNumberish; name?: string; chainId?: number; version?: string }
) {
  const [nonce, name, version, chainId] = await Promise.all([
    permitConfig?.nonce ?? token.nonces(wallet.address),
    permitConfig?.name ?? token.name(),
    permitConfig?.version ?? '1',
    permitConfig?.chainId ?? wallet.getChainId(),
  ])

  return splitSignature(
    await wallet._signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: wallet.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  )
}
