import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { ERC20CompLike, GovernorAlphaMock, GovernorBravoMock, Kernel, ObserverAlpha, ObserverBravo, Operator, OperatorFactory, Sequencer, SequencerFactory } from '../typechain';
import { compLikeFixture, governorAlphaFixture, governorBravoFixture } from './shared/fixtures';
import { operations } from './shared/functions';
import { expandTo18Decimals, MAX_UINT256, mineBlocks, ROOT } from './shared/utils';

const { BigNumber } = ethers;
const { createFixtureLoader, provider } = waffle;

describe('Operator', async () => {
  let abi = new ethers.utils.AbiCoder();
  let loadFixture;
  let wallet;
  let other1;
  let other2;

  let token: ERC20CompLike;
  let governorAlpha: GovernorAlphaMock;
  let governorBravo: GovernorBravoMock;

  let kernel: Kernel;
  let sequencerFactory: SequencerFactory;
  let operatorFactory: OperatorFactory;
  let sequencer: Sequencer;
  let operator: Operator;
  let observerAlpha: ObserverAlpha;
  let observerBravo: ObserverBravo;

  let virtualize: Function;
  let move: Function;
  let fetch: Function;

  const fixture = async () => {
    const Kernel = await ethers.getContractFactory('Kernel');
    const SequencerFactory = await ethers.getContractFactory('SequencerFactory');
    const OperatorFactory = await ethers.getContractFactory('OperatorFactory');
    const ObserverAlpha = await ethers.getContractFactory('ObserverAlpha');
    const ObserverBravo = await ethers.getContractFactory('ObserverBravo');

    ;({ token } = await compLikeFixture(provider, wallet));
    ;({ governor: governorAlpha } = await governorAlphaFixture(provider, token, wallet));
    ;({ governor: governorBravo } = await governorBravoFixture(provider, token, wallet));

    kernel = (await Kernel.deploy()) as Kernel;
    sequencerFactory = (await SequencerFactory.deploy()) as SequencerFactory;
    operatorFactory = (await OperatorFactory.deploy(kernel.address)) as OperatorFactory;
    observerAlpha = (await ObserverAlpha.deploy()) as ObserverAlpha;
    observerBravo = (await ObserverBravo.deploy()) as ObserverBravo;

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
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
  };

  const realizeFixture = async () => {
    await fixture();

    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));

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

    describe('sequencer', async () => {
      let selector;

      before(async () => {
        selector = operator.interface.getSighash('sequencer');
      });

      it('should set', async () => {
        await operator.set(selector, abi.encode(['address'], [sequencer.address]));
        expect(await operator.sequencer()).to.equal(sequencer.address);
      });
      it('should change', async () => {
        await operator.set(selector, abi.encode(['address'], [sequencer.address]));
        expect(await operator.sequencer()).to.equal(sequencer.address);
        await operator.set(selector, abi.encode(['address'], [wallet.address]));
        expect(await operator.sequencer()).to.equal(wallet.address);
      });
      it('should set to arbitrary address', async () => {
        await operator.set(selector, abi.encode(['address'], [wallet.address]));
        expect(await operator.sequencer()).to.equal(wallet.address);
      });
    });

    describe('governor', async () => {
      let selector;

      before(async () => {
        selector = operator.interface.getSighash('governor');
      });

      it('should set', async () => {
        await operator.set(selector, abi.encode(['address'], [governorAlpha.address]));
        expect(await operator.governor()).to.equal(governorAlpha.address);
      });
      it('should change', async () => {
        await operator.set(selector, abi.encode(['address'], [governorAlpha.address]));
        expect(await operator.governor()).to.equal(governorAlpha.address);
        await operator.set(selector, abi.encode(['address'], [wallet.address]));
        expect(await operator.governor()).to.equal(wallet.address);
      });
      it('should set to arbitrary address', async () => {
        await operator.set(selector, abi.encode(['address'], [wallet.address]));
        expect(await operator.governor()).to.equal(wallet.address);
      });
    });

    describe('observer', async () => {
      let selector;

      before(async () => {
        selector = operator.interface.getSighash('observer');
      });

      it('should set', async () => {
        await operator.set(selector, abi.encode(['address'], [observerAlpha.address]));
        expect(await operator.observer()).to.equal(observerAlpha.address);
      });
      it('should change', async () => {
        await operator.set(selector, abi.encode(['address'], [observerAlpha.address]));
        expect(await operator.observer()).to.equal(observerAlpha.address);
        await operator.set(selector, abi.encode(['address'], [wallet.address]));
        expect(await operator.observer()).to.equal(wallet.address);
      });
      it('should set to arbitrary address', async () => {
        await operator.set(selector, abi.encode(['address'], [wallet.address]));
        expect(await operator.observer()).to.equal(wallet.address);
      });
    });

    it('should set all', async () => {
      const sequencerSelector = operator.interface.getSighash('sequencer');
      const governorSelector = operator.interface.getSighash('governor');
      const observerSelector = operator.interface.getSighash('observer');

      await operator.set(sequencerSelector, abi.encode(['address'], [sequencer.address]));
      await operator.set(governorSelector, abi.encode(['address'], [governorAlpha.address]));
      await operator.set(observerSelector, abi.encode(['address'], [observerAlpha.address]));
    });

    it('should revert when no role', async () => {
      const sequencerSelector = operator.interface.getSighash('sequencer');
      const governorSelector = operator.interface.getSighash('governor');
      const observerSelector = operator.interface.getSighash('observer');

      await expect(operator.connect(other1).set(sequencerSelector, abi.encode(['address'], [sequencer.address])))
        .to.be.revertedWith('Access denied');
      await expect(operator.connect(other1).set(governorSelector, abi.encode(['address'], [governorAlpha.address])))
        .to.be.revertedWith('Access denied');
      await expect(operator.connect(other1).set(observerSelector, abi.encode(['address'], [observerAlpha.address])))
        .to.be.revertedWith('Access denied');
    });
  });

  describe('#virtualize', async () => {
    beforeEach(async () => {
      await loadFixture(virtualizeFixture);
    });

    describe('no observer', async () => {
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

    describe('observer', async () => {
      const propose = async (governor) => {
        await token.delegate(wallet.address);
        await governor.propose(
          [token.address],
          [0],
          ['mint(address,uint256)'],
          [abi.encode(['address', 'uint256'], [other1.address, expandTo18Decimals(100)])],
          `Mint to ${other1.address}`
        );
      };

      describe('alpha', async () => {
        beforeEach(async () => {
          await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governorAlpha.address]));
          await operator.set(operator.interface.getSighash('observer'), abi.encode(['address'], [observerAlpha.address]));
        });

        it('should virtualize when governor not active', async () => {
          await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
          expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
        });
        it('should virtualize when observer removed', async () => {
          await propose(governorAlpha);
          await expect(virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10))).to.be.revertedWith('CLPSE');
          await operator.set(operator.interface.getSighash('observer'), abi.encode(['address'], [ethers.constants.AddressZero]));
          await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
          expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
        });
        it('should revert when governor is active', async () => {
          await propose(governorAlpha);
          await expect(virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10))).to.be.revertedWith('CLPSE');
          await mineBlocks(provider, (await governorAlpha.votingPeriod()).toNumber());
          await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
          expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
        });
      });

      describe('bravo', async () => {
        beforeEach(async () => {
          await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governorBravo.address]));
          await operator.set(operator.interface.getSighash('observer'), abi.encode(['address'], [observerBravo.address]));
        });

        it('should virtualize when governor not active', async () => {
          await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
          expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
        });
        it('should virtualize when observer removed', async () => {
          await propose(governorBravo);
          await expect(virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10))).to.be.revertedWith('CLPSE');
          await operator.set(operator.interface.getSighash('observer'), abi.encode(['address'], [ethers.constants.AddressZero]));
          await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
          expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
        });
        it('should revert when governor is active', async () => {
          await propose(governorBravo);
          await expect(virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10))).to.be.revertedWith('CLPSE');
          await mineBlocks(provider, (await governorBravo.votingPeriod()).toNumber());
          await virtualize(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
          expect(await fetch(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
        });
      });
    });
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
