import { ethers } from 'hardhat';
import { Accumulator, ERC20CompLike, Kernel, OperatorA, OperatorB, OperatorMock, Sequencer } from '../../typechain';

import { evmBlockNumber, evmMiner, expandTo18Decimals, MaxUint128 } from "./utils";

type FunctionParameters = {
  token?: ERC20CompLike;
  kernel?: Kernel;
  operator?: OperatorA | OperatorB | OperatorMock,
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
  const join = async (caller, tox, toy, amount) => {
    await token.connect(caller).transfer(sequencer.address, amount);
    await operator.connect(caller).join(tox || caller.address, toy || caller.address);
  };

  const exit = async (caller, to) => {
    await operator.connect(caller).exit(to || caller.address);
  };

  const transfer = async (caller, to, x, y) => {
    await operator.connect(caller).transfer(to, x, y);
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

  return { propose, read, join, exit, transfer, use, collect, timetravel };
}
