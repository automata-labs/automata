import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { ERC20CompLike, Kernel, Operator, Sequencer } from '../typechain';
// @ts-ignore
import { SequencerFactory } from '../typechain/OperatorFactory.d.ts';
// @ts-ignore
import { OperatorFactory } from '../typechain/OperatorFactory.d.ts';
import { operations } from './shared/functions';
import { bytes32, expandTo18Decimals, MAX_UINT256, ROOT } from './shared/utils';

const { BigNumber } = ethers;
const { createFixtureLoader, provider } = waffle;

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

  let virtualize: Function;
  let move: Function;
  let fetch: Function;

  const fixture = async () => {
    const ERC20CompLike = await ethers.getContractFactory('ERC20CompLike');
    const Kernel = await ethers.getContractFactory('Kernel');
    const SequencerFactory = await ethers.getContractFactory('SequencerFactory');
    const OperatorFactory = await ethers.getContractFactory('OperatorFactory');

    const timestamp = (await provider.getBlock('latest')).timestamp;
    token = (await ERC20CompLike.deploy(wallet.address, wallet.address, timestamp + 60 * 60)) as ERC20CompLike;
    kernel = (await Kernel.deploy()) as Kernel;
    sequencerFactory = (await SequencerFactory.deploy()) as SequencerFactory;
    operatorFactory = (await OperatorFactory.deploy(kernel.address)) as OperatorFactory;

    await sequencerFactory.create(token.address);
    sequencer = (await ethers.getContractAt('Sequencer', await sequencerFactory.compute(token.address))) as Sequencer;

    await operatorFactory.create(token.address);
    operator = (await ethers.getContractAt('Operator', await operatorFactory.compute(token.address))) as Operator;

    ({ virtualize, move, fetch } = await operations({ token, kernel, operator }));
  };

  const virtualizeFixture = async () => {
    await fixture();

    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(
      operator.interface.getSighash('sequencer'),
      abi.encode(['address'], [sequencer.address])
    );
  };

  const realizeFixture = async () => {
    await fixture();

    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(
      operator.interface.getSighash('sequencer'),
      abi.encode(['address'], [sequencer.address])
    );

    await token.approve(operator.address, MAX_UINT256);
    await operator.multicall([
      operator.interface.encodeFunctionData('pay', [token.address, sequencer.address, expandTo18Decimals(100)]),
      operator.interface.encodeFunctionData('virtualize', [wallet.address, wallet.address]),
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
      await operator.set(
        operator.interface.getSighash('sequencer'),
        abi.encode(['address'], [sequencer.address])
      );
      expect(await operator.sequencer()).to.equal(sequencer.address);
    });
    it('should change sequencer', async () => {
      await operator.set(
        operator.interface.getSighash('sequencer'),
        abi.encode(['address'], [sequencer.address])
      );
      expect(await operator.sequencer()).to.equal(sequencer.address);
      await operator.set(
        operator.interface.getSighash('sequencer'),
        abi.encode(['address'], [wallet.address])
      );
      expect(await operator.sequencer()).to.equal(wallet.address);
    });
    it('should set non-sequencer contract', async () => {
      await operator.set(
        operator.interface.getSighash('sequencer'),
        abi.encode(['address'], [wallet.address])
      );
      expect(await operator.sequencer()).to.equal(wallet.address);
    });
    it('should revert when no role', async () => {
      await expect(
        operator.connect(other1).set(
          operator.interface.getSighash('sequencer'),
          abi.encode(['address'], [sequencer.address])
        )
      )
        .to.be.revertedWith('Access denied');
    });
  });

  describe('#virtualize', async () => {
    beforeEach(async () => {
      await loadFixture(virtualizeFixture);
    });

    it('should virtualize', async () => {
      await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
      expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
    });
    it('should virtualize multiple times', async () => {
      await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(500));
      await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
      expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(510), expandTo18Decimals(510)]);
    });
    it.skip('should virtualize with different accounts', async () => {});
    it('should virtualize to another accounts', async () => {
      await virtualize(wallet, other1.address, other2.address, expandTo18Decimals(10));
      expect(await fetch(token.address, other1.address)).to.eql([expandTo18Decimals(10), BigNumber.from(0)]);
      expect(await fetch(token.address, other2.address)).to.eql([BigNumber.from(0), expandTo18Decimals(10)]);
    });
    it('should virtualize zero tokens', async () => {
      await operator.virtualize(wallet.address, wallet.address);
    });
    it.skip('should virtualize dust', async () => {});
    it.skip('should virtualize line', async () => {});
    it('should virtualize to non-symmetric slot', async () => {
      await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(100));
      await move(wallet.address, other1.address, expandTo18Decimals(25), expandTo18Decimals(75));
      expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(75), expandTo18Decimals(25)]);
      expect(await fetch(token.address, other1.address)).to.eql([expandTo18Decimals(25), expandTo18Decimals(75)]);

      await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(100));
      expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(175), expandTo18Decimals(125)]);
    });
    it.skip('should emit an event', async () => {});
    it.skip('should revert when virtualizeing on zero shards', async () => {});
    it.skip('should revert when governor is active', async () => {});
    it.skip('should revert when overflowing sequencer space', async () => {});
  });

  describe('#realize', async () => {
    beforeEach(async () => {
      await loadFixture(realizeFixture);
    });

    it('should realize', async () => {
      const balanceBefore = await token.balanceOf(wallet.address);
      await move(wallet.address, operator.address, expandTo18Decimals(10), expandTo18Decimals(10));
      await operator.realize(wallet.address);
      const balanceAfter = await token.balanceOf(wallet.address);

      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));
    });
    it.skip('should realize multiple times', async () => {});
    it.skip('should realize with different accounts', async () => {});
    it.skip('should realize to another account', async () => {});
    it.skip('should realize dust', async () => {});
    it.skip('should realize line', async () => {});
    it.skip('should realize on non-symmetric slot', async () => {});
    it.skip('should realize when governor is active', async () => {});
    it.skip('should emit an event', async () => {});
    it.skip('should revert when realizeing zero tokens', async () => {});
    it.skip('should revert when realizeing on zero shards', async () => {});
    it.skip('should revert when underflowing sequencer space', async () => {});
  });
});
