import { ethers } from 'hardhat';

import { expandTo18Decimals, TIMELOCK_DELAY } from './utils';
import { ERC20CompLike, GovernorAlphaMock, GovernorBravoMock, Timelock } from '../../typechain';

const { Contract } = ethers;

export async function compLikeFixture(provider, wallet) {
  const ERC20CompLike = await ethers.getContractFactory('ERC20CompLike');
  const timestamp = (await provider.getBlock('latest')).timestamp;
  const token = (await ERC20CompLike.deploy(wallet.address, wallet.address, timestamp + 60 * 60)) as ERC20CompLike;

  return { token };
}

export async function governorAlphaFixture(provider, token, wallet) {
  const Timelock = await ethers.getContractFactory('Timelock');
  const GovernorAlphaMock = await ethers.getContractFactory('GovernorAlphaMock');

  const governorAlphaAddress = Contract.getContractAddress({ from: wallet.address, nonce: (await wallet.getTransactionCount()) + 2 });
  const timelock = (await Timelock.deploy(governorAlphaAddress, TIMELOCK_DELAY)) as Timelock;
  const governor = (await GovernorAlphaMock.deploy(timelock.address, token.address, wallet.address)) as GovernorAlphaMock;

  return { token, timelock, governor };
}

export async function governorBravoFixture(provider, token, wallet) {
  const Timelock = await ethers.getContractFactory('Timelock');
  const GovernorBravoMock = await ethers.getContractFactory('GovernorBravoMock');

  const governorBravoAddress = Contract.getContractAddress({ from: wallet.address, nonce: (await wallet.getTransactionCount()) + 2 });
  const timestamp = (await provider.getBlock('latest')).timestamp;
  const timelock = (await Timelock.deploy(governorBravoAddress, TIMELOCK_DELAY)) as Timelock;
  const governor = (await GovernorBravoMock.deploy(
    timelock.address,
    token.address,
    wallet.address,
    100,
    1,
    expandTo18Decimals(50000)
  )) as GovernorBravoMock;

  await governor['_initiate()']();

  return { token, timelock, governor };
}
