import { ethers, waffle } from 'hardhat';

import { shouldBehaveLikeExit, shouldBehaveLikeJoin, shouldBehaveLikeLinearRoute, shouldBehaveLikeMiscRoute, shouldBehaveLikeUse } from './Operator.behavior';
import { erc20CompLikeFixture, governorAlphaFixture } from './shared/fixtures';
import {
  deploy,
  expandTo18Decimals,
  ROOT,
} from './shared/utils';
import {
  Accumulator,
  ERC20CompLike,
  GovernorAlphaMock,
  Kernel,
  Linear,
  OperatorA,
  Root,
  Sequencer,
} from '../typechain';
import { functions } from './shared/functions';

const { MaxUint256 } = ethers.constants;
const { loadFixture, provider } = waffle;

describe('OperatorA', async () => {
  let abi = new ethers.utils.AbiCoder();
  let wallet;
  let other1;
  let other2;

  let token: ERC20CompLike;
  let governor: GovernorAlphaMock;

  let kernel: Kernel;
  let accumulator: Accumulator;
  let sequencer: Sequencer;
  let operator: OperatorA;
  let linear: Linear;
  let root: Root;

  let pid = 1;

  let propose;
  let read;
  let join;
  let exit;
  let collect;
  let use;
  let timetravel;
  let stake;

  const fixture = async () => {
    [wallet, other1, other2] = await provider.getWallets();

    token = await erc20CompLikeFixture(provider, wallet);
    ({ governor } = await governorAlphaFixture(provider, token, wallet));

    kernel = (await deploy('Kernel')) as Kernel;
    accumulator = (await deploy('Accumulator', kernel.address)) as Accumulator;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', kernel.address, token.address)) as OperatorA;
    linear = (await deploy('Linear')) as Linear;
    root = (await deploy('Root')) as Root;

    ({ propose, read, join, exit, collect, use, timetravel, stake } = functions({ token, kernel, accumulator, sequencer, operator }));
  };

  const joinFixture = async () => {
    await fixture();

    await token.approve(operator.address, MaxUint256);
    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, operator.address);

    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governor.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [expandTo18Decimals(10000)]));
  };

  const exitFixture = async () => {
    await joinFixture();
  };

  const useFixture = async () => {
    await fixture();

    await token.approve(operator.address, MaxUint256);
    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, operator.address);

    await operator.set(operator.interface.getSighash('accumulator'), abi.encode(['address'], [accumulator.address]));
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governor.address]));
    await operator.set(operator.interface.getSighash('period'), abi.encode(['uint32'], [80]));
    await operator.set(operator.interface.getSighash('computer'), abi.encode(['address'], [linear.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [expandTo18Decimals(10000)]));
  };

  const routeBaseFixture = async () => {
    await fixture();

    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, accumulator.address);
    await sequencer.grantRole(ROOT, operator.address);

    await operator.set(operator.interface.getSighash('accumulator'), abi.encode(['address'], [accumulator.address]));
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governor.address]));
    await operator.set(operator.interface.getSighash('period'), abi.encode(['uint32'], [80]));
    await operator.set(operator.interface.getSighash('computer'), abi.encode(['address'], [linear.address]));
    await operator.set(operator.interface.getSighash('observe'), abi.encode(['bool'], [false]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [expandTo18Decimals(10000)]));
  };

  const routeLinearFixture = async () => {
    await routeBaseFixture();

    await token.approve(operator.address, MaxUint256);
    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(3);
  };

  const routeMiscFixture = async () => {
    await routeBaseFixture();

    await token.approve(operator.address, MaxUint256);
    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(10);
  };

  describe('#join', async () => {
    beforeEach(async function () {
      await loadFixture(joinFixture);

      this.pid = pid;

      this.provider = provider;
      this.wallet = wallet;
      this.other1 = other1;
      this.other2 = other2;
      this.token = token;
      this.governor = governor;
      this.operator = operator;
      this.sequencer = sequencer;
      
      this.propose = propose;
      this.read = read;
      this.join = join;
      this.timetravel = timetravel;
      this.stake = stake;
    });

    shouldBehaveLikeJoin();
  });

  describe('#exit', async () => {
    beforeEach(async function () {
      await loadFixture(exitFixture);

      this.pid = pid;

      this.provider = provider;
      this.wallet = wallet;
      this.other1 = other1;
      this.other2 = other2;
      this.token = token;
      this.governor = governor;
      this.operator = operator;
      this.sequencer = sequencer;
      
      this.propose = propose;
      this.read = read;
      this.join = join;
      this.exit = exit;
      this.timetravel = timetravel;
      this.stake = stake;
    });

    shouldBehaveLikeExit();
  });

  describe('#use', async () => {
    beforeEach(async function () {
      await loadFixture(useFixture);

      this.pid = pid;

      this.provider = provider;
      this.wallet = wallet;
      this.token = token;
      this.governor = governor;
      this.accumulator = accumulator;
      this.operator = operator;
      
      this.propose = propose;
      this.join = join;
      this.timetravel = timetravel;
      this.stake = stake;
    });

    shouldBehaveLikeUse();
  });

  describe('#route', async () => {
    describe('linear', async () => {
      beforeEach(async function () {
        await loadFixture(routeLinearFixture);

        this.pid = pid;

        this.provider = provider;
        this.wallet = wallet;
        this.token = token;
        this.governor = governor;
        this.accumulator = accumulator;
        this.operator = operator;
        
        this.propose = propose;
        this.join = join;
        this.collect = collect;
        this.use = use;
        this.timetravel = timetravel;
        this.stake = stake;
      });

      shouldBehaveLikeLinearRoute();
    });
  
    describe('#misc', async () => {
      beforeEach(async function () {
        await loadFixture(routeMiscFixture);

        this.pid = pid;

        this.provider = provider;
        this.wallet = wallet;
        this.governor = governor;
        this.operator = operator;
        
        this.propose = propose;
        this.join = join;
        this.use = use;
        this.timetravel = timetravel;
        this.stake = stake;
      });

      shouldBehaveLikeMiscRoute();
    });
  });
});
