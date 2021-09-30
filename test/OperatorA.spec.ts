import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { erc20CompLikeFixture, governorAlphaFixture } from './shared/fixtures';
import {
  deploy,
  evmBlockNumber,
  expandTo18Decimals,
  expandWithDecimals,
  evmMiner,
  ROOT,
  MaxUint128,
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

  const join = async (caller, amount, tox?, toy?) => {
    await token.connect(caller).transfer(sequencer.address, amount);
    await operator.join(tox || caller.address, toy || caller.address);
  };

  const stake = async (caller, amount) => {
    await operator.connect(caller).transfer(accumulator.address, amount, 0);
    await accumulator.stake(token.address, caller.address);
  };

  const use = async (caller, amount, pid, support) => {
    await operator.connect(caller).transfer(accumulator.address, 0, amount);
    await operator.use(pid, support);
  };

  const collect = async (caller) => {
    await accumulator.connect(caller).collect(token.address, caller.address, MaxUint128);
  };

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

  const timetravel = async (pid, tag) => {
    let location;

    if (tag == 'start') location = 2;
    else if (tag == 'end') location = 3;
    else throw new Error('Invalid tag.');

    const start = (await operator.timeline(pid))[location].toNumber();
    const current = await evmBlockNumber(provider);

    await evmMiner(provider, start - current + 1);
  };

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

  describe('#use', async () => {
    beforeEach(async () => {
      await loadFixture(useFixture);
    });

    it('should use', async () => {
      await join(wallet, expandTo18Decimals(100), accumulator.address, wallet.address);
      await accumulator.stake(token.address, wallet.address);
      await propose(governor);

      // vote `100` for
      await operator.transfer(accumulator.address, 0, expandTo18Decimals(75));
      await operator.use(pid, 1);

      // vote `50` against
      await operator.transfer(accumulator.address, 0, expandTo18Decimals(25));
      await operator.use(pid, 0);

      expect((await operator.votes(pid)).x).to.equal(expandTo18Decimals(75));
      expect((await operator.votes(pid)).y).to.equal(expandTo18Decimals(25));
    });
    it('should revert when pid is invalid', async () => {
      await join(wallet, expandTo18Decimals(100));
      await stake(wallet, expandTo18Decimals(100));
      await propose(governor);

      await operator.transfer(accumulator.address, 0, expandTo18Decimals(100));
      await expect(operator.use(333, 1)).to.be.revertedWith('GovernorAlpha::state: invalid proposal id');
    });
    it.skip('should revert when `use` has not started', async () => {});
    it('should revert when `use` has ended', async () => {
      await join(wallet, expandTo18Decimals(100));
      await stake(wallet, expandTo18Decimals(100));
      await propose(governor);
      await timetravel(pid, 'start');

      await operator.transfer(accumulator.address, 0, expandTo18Decimals(100));
      await expect(operator.use(pid, 1)).to.be.revertedWith('END');
    });
    it('should revert when proposal has ended', async () => {
      await join(wallet, expandTo18Decimals(100));
      await stake(wallet, expandTo18Decimals(100));
      await propose(governor);
      await timetravel(pid, 'end');

      await operator.transfer(accumulator.address, 0, expandTo18Decimals(100));
      await expect(operator.use(pid, 1)).to.be.revertedWith('OBS');
    });
    it('should revert when using zero', async () => {
      await join(wallet, expandTo18Decimals(100));
      await stake(wallet, expandTo18Decimals(100));
      await propose(governor);

      await expect(operator.use(pid, 1)).to.be.revertedWith('0');
    });
    it('should revert when nothing staked', async () => {
      await expect(operator.use(pid, 1)).to.be.reverted;
    });
    it('should revert when proposal is not created', async () => {
      await join(wallet, expandTo18Decimals(100));
      await stake(wallet, expandTo18Decimals(100));
      await expect(operator.use(pid, 1)).to.be.revertedWith('E');
    });
    it('should emit an event', async () => {
      await join(wallet, expandTo18Decimals(100));
      await stake(wallet, expandTo18Decimals(100));
      await propose(governor);

      await operator.transfer(accumulator.address, 0, expandTo18Decimals(100));
      await expect(operator.use(pid, 1)).to.emit(operator, 'Used').withArgs(wallet.address, pid, 1);
    });
  });

  describe('#route', async () => {
    describe('linear', async () => {
      beforeEach(async () => {
        await loadFixture(routeLinearFixture);
      });

      it('(0.5, 0) => (0.5, 0) | 0.5', async () => {
        await join(wallet, expandWithDecimals(5, 17));
        await stake(wallet, expandWithDecimals(5, 17));
        await propose(governor);

        await use(wallet, expandWithDecimals(5, 17), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('(0.9, 0) => (0.9, 0) | 0.9', async () => {
        await join(wallet, expandWithDecimals(9, 17));
        await stake(wallet, expandWithDecimals(9, 17));
        await propose(governor);

        await use(wallet, expandWithDecimals(9, 17), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('(1.1, 0) => (1.1, 0) | 1.1', async () => {
        await join(wallet, expandWithDecimals(11, 17));
        await stake(wallet, expandWithDecimals(11, 17));
        await propose(governor);

        await use(wallet, expandWithDecimals(11, 17), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await operator.route(pid, 0);
      });
      it('(0, 0) => (0, 0) | 0', async () => {
        await propose(governor);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('(1, 0) => (1, 0) | 1', async () => {
        await join(wallet, expandTo18Decimals(1));
        await propose(governor);
        await stake(wallet, expandTo18Decimals(1));
        await use(wallet, expandTo18Decimals(1), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await operator.route(pid, 0);
      });
      it('(2, 0) => (2, 0) | 2', async () => {
        await join(wallet, expandTo18Decimals(2));
        await propose(governor);
        await stake(wallet, expandTo18Decimals(2));
        await use(wallet, expandTo18Decimals(2), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await operator.route(pid, 1); // 1
        await operator.route(pid, 0); // 1
      });
      it('(3, 0) => (3, 0) | 3', async () => {
        await join(wallet, expandTo18Decimals(3));
        await stake(wallet, expandTo18Decimals(3));
        await propose(governor);
        await use(wallet, expandTo18Decimals(3), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await operator.route(pid, 1);
        await operator.route(pid, 0);
      });
      it('(4, 0) => (4, 0) | 4', async () => {
        await join(wallet, expandTo18Decimals(4));
        await stake(wallet, expandTo18Decimals(4));
        await propose(governor);
        await use(wallet, expandTo18Decimals(4), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2); // 1
        await operator.route(pid, 1); // 2
        await operator.route(pid, 0); // 1
      });
      it('(5, 0) => (5, 0) | 5', async () => {
        await join(wallet, expandTo18Decimals(5));
        await stake(wallet, expandTo18Decimals(5));
        await propose(governor);
        await use(wallet, expandTo18Decimals(5), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2); // 2
        await operator.route(pid, 1); // 2
        await operator.route(pid, 0); // 1
      });
      it('(6, 0) => (6, 0) | 6', async () => {
        await join(wallet, expandTo18Decimals(6));
        await stake(wallet, expandTo18Decimals(6));
        await propose(governor);
        await use(wallet, expandTo18Decimals(6), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2); // 3
        await operator.route(pid, 1); // 2
        await operator.route(pid, 0); // 1
      });
      it('(7, 0) => (7, 0) | 7', async () => {
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await propose(governor);
        await use(wallet, expandTo18Decimals(7), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2); // 4
        await operator.route(pid, 1); // 2
        await operator.route(pid, 0); // 1
      });
      it('(8, 0) => (8, 0) | 7', async () => {
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await propose(governor);
        await use(wallet, expandTo18Decimals(7), pid, 1);
        await accumulator.collect(token.address, wallet.address, expandTo18Decimals(10));
        await use(wallet, expandTo18Decimals(1), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2); // 4
        await operator.route(pid, 1); // 2
        await operator.route(pid, 0); // 1
      });
      it('(0, 0) => (0, 0) | 7', async () => {
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await propose(governor);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('(1, 0) => (1, 0) | 7', async () => {
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await propose(governor);

        await use(wallet, expandTo18Decimals(1), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await operator.route(pid, 0);
      });
      it('(2, 0) => (2, 0) | 7', async () => {
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await propose(governor);

        await use(wallet, expandTo18Decimals(2), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await operator.route(pid, 1);
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('(3, 0) => (3, 0) | 7', async () => {
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await propose(governor);

        await use(wallet, expandTo18Decimals(3), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await operator.route(pid, 1);
        await operator.route(pid, 0);
      });
      it('(4, 0) => (4, 0) | 7', async () => {
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await propose(governor);

        await use(wallet, expandTo18Decimals(4), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2);
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('(7, 7) => (0, 0) | 7', async () => {
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await propose(governor);

        await use(wallet, expandTo18Decimals(7), pid, 1);
        await accumulator.collect(token.address, wallet.address, expandTo18Decimals(10));
        await use(wallet, expandTo18Decimals(7), pid, 0);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('(7, 4) => (3, 0) | 7', async () => {
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await propose(governor);

        await use(wallet, expandTo18Decimals(7), pid, 1);
        await accumulator.collect(token.address, wallet.address, expandTo18Decimals(10));
        await use(wallet, expandTo18Decimals(4), pid, 0);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await operator.route(pid, 1);
        await operator.route(pid, 0);
      });
      it('(0, 1) => (0, 1) | 7', async () => {
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await propose(governor);

        await use(wallet, expandTo18Decimals(1), pid, 0);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await operator.route(pid, 0);
      });

      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          const max = 7;

          it(`(${i}, ${j}) => (${Math.max(i - j, 0)}, ${Math.max(j - i, 0)}) | ${max}`, async () => {
            await join(wallet, expandTo18Decimals(max));
            await stake(wallet, expandTo18Decimals(max));
            await propose(governor);

            if (i > 0) await use(wallet, expandTo18Decimals(i), pid, 1);
            if (i > 0) await collect(wallet);
            if (j > 0) await use(wallet, expandTo18Decimals(j), pid, 0);

            await timetravel(pid, 'start');

            let dust = 0;

            if ((Math.abs(i - j) & 4) == 4) {
              await operator.route(pid, 2);
              dust++;
            } else {
              await expect(operator.route(pid, 2)).to.be.revertedWith('F');
            }

            if ((Math.abs(i - j) & 2) == 2) {
              await operator.route(pid, 1);
              dust++;
            } else {
              await expect(operator.route(pid, 1)).to.be.revertedWith('F');
            }

            if ((Math.abs(i - j) & 1) == 1) {
              await operator.route(pid, 0);
              dust++;
            } else {
              await expect(operator.route(pid, 0)).to.be.revertedWith('F');
            }

            if (i - j > 0) {
              expect((await governor.proposals(pid)).forVotes)
                .to.equal(expandTo18Decimals(Math.max(i - j, 0)).add(dust));
            } else {
              expect((await governor.proposals(pid)).forVotes).to.equal(0);
            }

            if (j - i > 0) {
              expect((await governor.proposals(pid)).againstVotes)
                .to.equal(expandTo18Decimals(Math.max(j - i, 0)).add(dust));
            } else {
              expect((await governor.proposals(pid)).againstVotes).to.equal(0);
            }
          });
        }
      }
    });

    describe('misc', async () => {
      beforeEach(async () => {
        await loadFixture(routeMiscFixture);
      });

      it('(100, 0) => (100, 0) | 100', async () => {
        await join(wallet, expandTo18Decimals(100));
        await stake(wallet, expandTo18Decimals(100));
        await propose(governor);

        await use(wallet, expandTo18Decimals(100), 1, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 10)).to.be.revertedWith('F');
        await expect(operator.route(pid, 9)).to.be.revertedWith('F');
        await expect(operator.route(pid, 8)).to.be.revertedWith('F');
        await expect(operator.route(pid, 7)).to.be.revertedWith('F');
        await operator.route(pid, 6);
        await operator.route(pid, 5);
        await operator.route(pid, 4);
        await operator.route(pid, 3);
        await operator.route(pid, 2);
        await operator.route(pid, 1);
        await operator.route(pid, 0);
      });
      it('(75, 0) => (75, 0) | 75', async () => {
        // route with 75 - filled 63 and excess 12 => 75.
        await join(wallet, expandTo18Decimals(75));
        await stake(wallet, expandTo18Decimals(75));
        await propose(governor);

        await use(wallet, expandTo18Decimals(75), 1, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 10)).to.be.revertedWith('F');
        await expect(operator.route(pid, 9)).to.be.revertedWith('F');
        await expect(operator.route(pid, 8)).to.be.revertedWith('F');
        await expect(operator.route(pid, 7)).to.be.revertedWith('F');
        await operator.route(pid, 6);
        await operator.route(pid, 5);
        await operator.route(pid, 4);
        await operator.route(pid, 3);
        await operator.route(pid, 2);
        await operator.route(pid, 1);
        await operator.route(pid, 0);
      });
      it('(38, 0) => (38, 0) | 38', async () => {
        await join(wallet, expandTo18Decimals(38));
        await stake(wallet, expandTo18Decimals(38));
        await propose(governor);

        await use(wallet, expandTo18Decimals(38), 1, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 10)).to.be.revertedWith('F');
        await expect(operator.route(pid, 9)).to.be.revertedWith('F');
        await expect(operator.route(pid, 8)).to.be.revertedWith('F');
        await expect(operator.route(pid, 7)).to.be.revertedWith('F');
        await expect(operator.route(pid, 6)).to.be.revertedWith('F');
        await operator.route(pid, 5);
        await operator.route(pid, 4);
        await operator.route(pid, 3);
        await operator.route(pid, 2);
        await operator.route(pid, 1);
        await operator.route(pid, 0);
      });
      it('(75, 0) => (75, 0) | 100', async () => {
        await join(wallet, expandTo18Decimals(100));
        await stake(wallet, expandTo18Decimals(100));
        await propose(governor);

        await use(wallet, expandTo18Decimals(75), 1, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 10)).to.be.revertedWith('F');
        await expect(operator.route(pid, 9)).to.be.revertedWith('F');
        await expect(operator.route(pid, 8)).to.be.revertedWith('F');
        await expect(operator.route(pid, 7)).to.be.revertedWith('F');
        await operator.route(pid, 6);
        await operator.route(pid, 5);
        await expect(operator.route(pid, 4)).to.be.revertedWith('F');
        await expect(operator.route(pid, 3)).to.be.revertedWith('F');
        await operator.route(pid, 2);
        await operator.route(pid, 1);
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('(50, 25) => (50, 25) | 100', async () => {
        await join(wallet, expandTo18Decimals(100));
        await stake(wallet, expandTo18Decimals(100));
        await propose(governor);

        await use(wallet, expandTo18Decimals(50), 1, 1);
        await use(wallet, expandTo18Decimals(25), 1, 0);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 10)).to.be.revertedWith('F');
        await expect(operator.route(pid, 9)).to.be.revertedWith('F');
        await expect(operator.route(pid, 8)).to.be.revertedWith('F');
        await expect(operator.route(pid, 7)).to.be.revertedWith('F');
        await expect(operator.route(pid, 6)).to.be.revertedWith('F');
        await expect(operator.route(pid, 5)).to.be.revertedWith('F');
        await operator.route(pid, 4);
        await operator.route(pid, 3);
        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await operator.route(pid, 0);
      });
    });
  });
});
