import { ethers } from 'hardhat';
import { Accumulator, ERC20CompLike, Kernel, OperatorA, OperatorB, Sequencer } from '../../typechain';

import { evmBlockNumber, evmMiner, expandTo18Decimals, MaxUint128 } from "./utils";

type FunctionParameters = {
  token?: ERC20CompLike;
  kernel?: Kernel;
  operator?: OperatorA | OperatorB,
  sequencer?: Sequencer,
  accumulator?: Accumulator,
}

export function functions({ token, kernel, operator, sequencer, accumulator }: FunctionParameters) {
  let abi = new ethers.utils.AbiCoder();

  // Governor
  const propose = async (caller, governor, to?) => {
    await token.delegate(caller.address);
    await governor.propose(
      [token.address],
      [0],
      ['mint(address,uint256)'],
      [abi.encode(['address', 'uint256'], [to || caller.address, expandTo18Decimals(100)])],
      `Mint to ${to || caller.address}`
    );
  };

  // Kernel
  const read = (tokenAddress, userAddress) => {
    return kernel.read(ethers.utils.keccak256(abi.encode(['address', 'address'], [tokenAddress, userAddress])));
  };

  // Operator
  const join = async (caller, amount, tox?, toy?) => {
    await token.connect(caller).transfer(sequencer.address, amount);
    await operator.join(tox || caller.address, toy || caller.address);
  };

  const exit = async (caller, amount, to?) => {
    await operator.connect(caller).transfer(operator.address, amount, amount);
    await operator.exit(to || caller.address);
  };

  const use = async (caller, amount, pid, support) => {
    await operator.connect(caller).transfer(accumulator.address, 0, amount);
    await operator.use(pid, support);
  };

  const collect = async (caller, to?) => {
    await accumulator.connect(caller).collect(token.address, to || caller.address, MaxUint128);
  };

  const timetravel = async (provider, pid, tag) => {
    let location;

    if (tag == 'start') location = 2;
    else if (tag == 'end') location = 3;
    else throw new Error('Invalid tag.');

    const start = (await operator.timeline(pid))[location].toNumber();
    const current = await evmBlockNumber(provider);

    await evmMiner(provider, start - current + 1);
  };

  // Accumulator
  const stake = async (caller, amount) => {
    await operator.connect(caller).transfer(accumulator.address, amount, 0);
    await accumulator.stake(token.address, caller.address);
  };

  const globs = async (underlying: string) => {
    return accumulator.globs(underlying);
  };

  const units = async (underlying: string, owner: string) => {
    return accumulator.units(ethers.utils.keccak256(abi.encode(['address', 'address'], [underlying, owner])));
  };

  const normalized = async (underlying: string, owner: string) => {
    return accumulator.get(underlying, owner);
  };

  return { propose, read, join, exit, use, collect, timetravel, stake, globs, units, normalized };
}