import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { ERC20CompLike, Kernel, Operator, Sequencer } from '../typechain';
// @ts-ignore
import { SequencerFactory } from '../typechain/OperatorFactory.d.ts';
// @ts-ignore
import { OperatorFactory } from '../typechain/OperatorFactory.d.ts';
import { operations } from './shared/functions';
import { expandTo18Decimals, getCurrentTimestamp, MAX_UINT256, ROOT } from './shared/utils';

const { BigNumber } = ethers;
const { createFixtureLoader } = waffle;

describe('Operator', async () => {
  let abi = new ethers.utils.AbiCoder();
  let loadFixture;
  let wallet;
  let other1;
  let other2;

  let token: ERC20CompLike;

  let kernel: Kernel;
  let sequencerFactory: SequencerFactory;
  let operatorFactory: OperatorFactory;
  let sequencer: Sequencer;
  let operator: Operator;

  let join: Function;
  let move: Function;
  let fetch: Function;

  const fixture = async () => {
    const ERC20CompLike = await ethers.getContractFactory('ERC20CompLike');
    const Kernel = await ethers.getContractFactory('Kernel');
    const SequencerFactory = await ethers.getContractFactory('SequencerFactory');
    const OperatorFactory = await ethers.getContractFactory('OperatorFactory');

    token = (await ERC20CompLike.deploy(wallet.address, wallet.address, await getCurrentTimestamp() + 60 * 60)) as ERC20CompLike;
    kernel = (await Kernel.deploy()) as Kernel;
    sequencerFactory = (await SequencerFactory.deploy()) as SequencerFactory;
    operatorFactory = (await OperatorFactory.deploy(kernel.address)) as OperatorFactory;

    await sequencerFactory.create(token.address);
    sequencer = (await ethers.getContractAt('Sequencer', await sequencerFactory.compute(token.address))) as Sequencer;

    await operatorFactory.create(token.address);
    operator = (await ethers.getContractAt('Operator', await operatorFactory.compute(token.address))) as Operator;

    ({ join, move, fetch } = await operations(token, kernel, operator));
  };

  const joinFixture = async () => {
    await fixture();

    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(sequencer.address);
  };

  const exitFixture = async () => {
    await fixture();

    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(sequencer.address);

    await token.approve(operator.address, MAX_UINT256);
    await operator.multicall([
      operator.interface.encodeFunctionData('pay', [token.address, sequencer.address, expandTo18Decimals(100)]),
      operator.interface.encodeFunctionData('join', [wallet.address, wallet.address]),
    ]);
  };

  before('fixture loader', async () => {
    ;([wallet, other1, other2] = await ethers.getSigners());
    loadFixture = createFixtureLoader([wallet]);
  });

  describe('#set', async () => {
    beforeEach(async () => {
      await loadFixture(fixture);
    });

    it('should set sequencer', async () => {
      await operator.set(sequencer.address);
      expect(await operator.sequencer()).to.equal(sequencer.address);
    });
    it('should change sequencer', async () => {
      await operator.set(sequencer.address);
      expect(await operator.sequencer()).to.equal(sequencer.address);
      await operator.set(wallet.address);
      expect(await operator.sequencer()).to.equal(wallet.address);
    });
    it('should set non-sequencer contract', async () => {
      await operator.set(wallet.address);
      expect(await operator.sequencer()).to.equal(wallet.address);
    });
    it('should revert when no role', async () => {
      await expect(operator.connect(other1).set(sequencer.address))
        .to.be.revertedWith('Access denied');
    });
  });

  describe('#join', async () => {
    beforeEach(async () => {
      await loadFixture(joinFixture);
    });

    it('should join', async () => {
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
      expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
    });
    it('should join multiple times', async () => {
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(500));
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
      expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(510), expandTo18Decimals(510)]);
    });
    it.skip('should join with different accounts', async () => {});
    it('should join to another accounts', async () => {
      await join(wallet, other1.address, other2.address, expandTo18Decimals(10));
      expect(await fetch(token.address, other1.address)).to.eql([expandTo18Decimals(10), BigNumber.from(0)]);
      expect(await fetch(token.address, other2.address)).to.eql([BigNumber.from(0), expandTo18Decimals(10)]);
    });
    it('should join zero tokens', async () => {
      await operator.join(wallet.address, wallet.address);
    });
    it.skip('should join dust', async () => {});
    it.skip('should join line', async () => {});
    it('should join to non-symmetric state', async () => {
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(100));
      await move(wallet.address, other1.address, expandTo18Decimals(25), expandTo18Decimals(75));
      expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(75), expandTo18Decimals(25)]);
      expect(await fetch(token.address, other1.address)).to.eql([expandTo18Decimals(25), expandTo18Decimals(75)]);

      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(100));
      expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(175), expandTo18Decimals(125)]);
    });
    it.skip('should emit an event', async () => {});
    it.skip('should revert when joining on zero shards', async () => {});
    it.skip('should revert when governor is active', async () => {});
    it.skip('should revert when overflowing sequencer space', async () => {});
  });

  describe('#exit', async () => {
    beforeEach(async () => {
      await loadFixture(exitFixture);
    });

    it('should exit', async () => {
      const balanceBefore = await token.balanceOf(wallet.address);
      await move(wallet.address, operator.address, expandTo18Decimals(10), expandTo18Decimals(10));
      await operator.exit(wallet.address);
      const balanceAfter = await token.balanceOf(wallet.address);

      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));
    });
    it.skip('should exit multiple times', async () => {});
    it.skip('should exit with different accounts', async () => {});
    it.skip('should exit to another account', async () => {});
    it.skip('should exit dust', async () => {});
    it.skip('should exit line', async () => {});
    it.skip('should exit on non-symmetric state', async () => {});
    it.skip('should exit when governor is active', async () => {});
    it.skip('should emit an event', async () => {});
    it.skip('should revert when exiting zero tokens', async () => {});
    it.skip('should revert when exiting on zero shards', async () => {});
    it.skip('should revert when underflowing sequencer space', async () => {});
  });
});
