import { BigNumberish } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "ethers";

import { MAX_UINT256 } from "./utils";
import { Accumulator, ERC20CompLike, Kernel, Operator } from "../../typechain";

type Context = {
  token?: ERC20CompLike;
  kernel?: Kernel;
  operator?: Operator;
  accumulator?: Accumulator;
};

export async function operations(context: Context) {
  const { token, kernel, operator, accumulator } = context;
  const abi = new ethers.utils.AbiCoder();

  const virtualize = async (sender: SignerWithAddress, tox: string, toy: string, amount: BigNumberish) => {
    await token.connect(sender).approve(operator.address, MAX_UINT256);
    const sequencer = await operator.sequencer();
    await operator.connect(sender).multicall([
      operator.interface.encodeFunctionData('pay', [token.address, sequencer, amount]),
      operator.interface.encodeFunctionData('virtualize', [tox, toy]),
    ]);
  };

  const move = async (from: string, to: string, x: BigNumberish, y: BigNumberish) => {
    const key0 = ethers.utils.keccak256(abi.encode(['address', 'address'], [token.address, from]));
    const key1 = ethers.utils.keccak256(abi.encode(['address', 'address'], [token.address, to]));
    await kernel.transfer(key0, key1, x, y);
  };

  const fetch = async (underlying: string, owner: string) => {
    return kernel.get(ethers.utils.keccak256(abi.encode(['address', 'address'], [underlying, owner])));
  };

  const getState = async (underlying: string, owner: string) => {
    return accumulator.states(ethers.utils.keccak256(abi.encode(['address', 'address'], [underlying, owner])));
  };

  return { virtualize, move, fetch, getState };
}
