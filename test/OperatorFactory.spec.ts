import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { ERC20, Kernel, Operator, OperatorFactory } from '../typechain';

const { createFixtureLoader } = waffle;

describe('OperatorFactory', async () => {
  let loadFixture;
  let wallet;

  let token0: ERC20;
  let token1: ERC20;

  let kernel: Kernel;
  let operatorFactory: OperatorFactory;

  const fixture = async () => {
    const ERC20 = await ethers.getContractFactory('ERC20');
    const Kernel = await ethers.getContractFactory('Kernel');
    const OperatorFactory = await ethers.getContractFactory('OperatorFactory');

    token0 = (await ERC20.deploy("Token0", "T0", 18)) as ERC20;
    token1 = (await ERC20.deploy("Token1", "T1", 18)) as ERC20;
    kernel = (await Kernel.deploy()) as Kernel;
    operatorFactory = (await OperatorFactory.deploy(kernel.address)) as OperatorFactory;
  };

  before('fixture loader', async () => {
    ;([wallet] = await ethers.getSigners());
    loadFixture = createFixtureLoader([wallet]);
  });

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe('#create', async () => {
    it('should create', async () => {
      let operatorAddress: string;
      let operator: Operator;

      await operatorFactory.create(token0.address);
      operatorAddress = await operatorFactory.compute(token0.address);
      operator = (await ethers.getContractAt('Operator', operatorAddress)) as Operator;
      expect(await operator.kernel()).to.equal(kernel.address);
      expect(await operator.underlying()).to.equal(token0.address);
      
      await operatorFactory.create(token1.address);
      operatorAddress = await operatorFactory.compute(token1.address);
      operator = (await ethers.getContractAt('Operator', operatorAddress)) as Operator;
      expect(await operator.kernel()).to.equal(kernel.address);
      expect(await operator.underlying()).to.equal(token1.address);
    });
    it('should create on non-contract address', async () => {
      await operatorFactory.create(ethers.constants.AddressZero);
      await operatorFactory.create(wallet.address);
    });
    it('should revert when operator already deployed', async () => {
      await operatorFactory.create(token0.address);
      await expect(operatorFactory.create(token0.address)).to.be.reverted;
    });
  });
});
