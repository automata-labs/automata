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

const { BigNumber } = ethers;
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

  const read = (tokenAddr, walletAddr) => {
    return kernel.read(ethers.utils.keccak256(abi.encode(['address', 'address'], [tokenAddr, walletAddr])));
  };

  const join = async (caller, amount, tox?, toy?) => {
    await token.connect(caller).transfer(sequencer.address, amount);
    await operator.join(tox || caller.address, toy || caller.address);
  };

  const exit = async (caller, amount, to?) => {
    await operator.connect(caller).transfer(operator.address, amount, amount);
    await operator.exit(to || caller.address);
  };

  const stake = async (caller, amount) => {
    await operator.connect(caller).transfer(accumulator.address, amount, 0);
    await accumulator.stake(token.address, caller.address);
  };

  const use = async (caller, amount, pid, support) => {
    await operator.connect(caller).transfer(accumulator.address, 0, amount);
    await operator.use(pid, support);
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

    const current = await evmBlockNumber(provider);
    const start = (await operator.timeline(pid))[location].toNumber();

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
    beforeEach(async () => {
      await loadFixture(joinFixture);
    });

    it('should join', async () => {
      await join(wallet, expandTo18Decimals(10));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
    });
    it('should join multiple times', async () => {
      await join(wallet, expandTo18Decimals(500));
      await join(wallet, expandTo18Decimals(10));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(510), expandTo18Decimals(510)]);
    });
    it('should join dust', async () => {
      await join(wallet, 1);
      expect(await read(token.address, wallet.address)).to.eql([BigNumber.from(1), BigNumber.from(1)]);
    });
    it('should join line', async () => {
      await join(wallet, expandTo18Decimals(1023));
      await expect(join(wallet, expandTo18Decimals(1023))).to.be.reverted.revertedWith('OVF');
    });
    it('should join with different accounts', async () => {
      await join(wallet, expandTo18Decimals(10));
      await token.transfer(other1.address, expandTo18Decimals(20));
      await join(other1, expandTo18Decimals(20));

      // `wallet`
      expect((await read(token.address, wallet.address)).x).to.equal(expandTo18Decimals(10));
      expect((await read(token.address, wallet.address)).y).to.equal(expandTo18Decimals(10));

      // `other1`
      expect((await read(token.address, other1.address)).x).to.equal(expandTo18Decimals(20));
      expect((await read(token.address, other1.address)).y).to.equal(expandTo18Decimals(20));
    });
    it('should join to another accounts', async () => {
      await join(wallet, expandTo18Decimals(10), other1.address, other2.address);
      expect(await read(token.address, other1.address)).to.eql([expandTo18Decimals(10), BigNumber.from(0)]);
      expect(await read(token.address, other2.address)).to.eql([BigNumber.from(0), expandTo18Decimals(10)]);
    });
    it('should join to a slot with non-symmetric values', async () => {
      await join(wallet, expandTo18Decimals(100));
      await operator.transfer(other1.address, expandTo18Decimals(25), expandTo18Decimals(75));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(75), expandTo18Decimals(25)]);
      expect(await read(token.address, other1.address)).to.eql([expandTo18Decimals(25), expandTo18Decimals(75)]);

      await join(wallet, expandTo18Decimals(100));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(175), expandTo18Decimals(125)]);
    });
    it('should join when governor not active', async () => {
      await join(wallet, expandTo18Decimals(10));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
    });
    it('should join when governor active but observe is false', async () => {
      await operator.set(operator.interface.getSighash('observe'), abi.encode(['bool'], [false]));
      await propose(governor);
      await join(wallet, expandTo18Decimals(10));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
    });
    it('should revert when zero tokens', async () => {
      await expect(operator.join(wallet.address, wallet.address)).to.be.revertedWith('0');
    });
    it('should revert when overflowing limit', async () => {
      await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [expandTo18Decimals(100)]));
      await join(wallet, expandTo18Decimals(100));
      await expect(join(wallet, 1)).to.be.revertedWith('LIM');
    });
    it('should revert when governor is active', async () => {
      await propose(governor);

      await token.transfer(sequencer.address, expandTo18Decimals(10));
      await expect(operator.join(wallet.address, wallet.address)).to.be.revertedWith('OBS');
      await evmMiner(provider, (await governor.votingPeriod()).toNumber());
      await operator.join(wallet.address, wallet.address);
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
    });
    it('should revert when overflowing sequencer space', async () => {
      await join(wallet, expandTo18Decimals(1023));
      await expect(join(wallet, 1)).to.be.revertedWith('OVF');
    });
    it('should emit an event', async () => {
      await token.transfer(sequencer.address, expandTo18Decimals(1));
      await expect(operator.join(wallet.address, wallet.address))
        .to.emit(operator, 'Joined')
        .withArgs(wallet.address, wallet.address, wallet.address, expandTo18Decimals(1));
    });
  });

  describe('#exit', async () => {
    beforeEach(async () => {
      await loadFixture(exitFixture);
    });

    it('should exit', async () => {
      await join(wallet, expandTo18Decimals(500));

      const balanceBefore = await token.balanceOf(wallet.address);
      await exit(wallet, expandTo18Decimals(10));
      const balanceAfter = await token.balanceOf(wallet.address);
      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));
    });
    it('should exit multiple times', async () => {
      await join(wallet, expandTo18Decimals(500));

      const balanceBefore = await token.balanceOf(wallet.address);
      await exit(wallet, expandTo18Decimals(10));
      await exit(wallet, expandTo18Decimals(20));
      const balanceAfter = await token.balanceOf(wallet.address);
      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(30)));
      expect((await read(token.address, wallet.address)).x).to.equal(expandTo18Decimals(470));
    });
    it('should exit with different accounts', async () => {
      let balanceBefore;
      let balanceAfter;

      await join(wallet, expandTo18Decimals(100));
      await token.transfer(other1.address, expandTo18Decimals(100));
      await join(other1, expandTo18Decimals(100));

      balanceBefore = await token.balanceOf(wallet.address);
      await exit(wallet, expandTo18Decimals(10));
      balanceAfter = await token.balanceOf(wallet.address);
      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));

      balanceBefore = await token.balanceOf(other1.address);
      await exit(other1, expandTo18Decimals(10));
      balanceAfter = await token.balanceOf(other1.address);
      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));
    });
    it('should exit to another account', async () => {
      await join(wallet, expandTo18Decimals(100));

      const balanceBefore = await token.balanceOf(other1.address);
      await exit(wallet, expandTo18Decimals(10), other1.address);
      const balanceAfter = await token.balanceOf(other1.address);
      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));
    });
    it('should exit dust', async () => {
      await join(wallet, expandTo18Decimals(100));

      const balanceBefore = await token.balanceOf(wallet.address);
      await exit(wallet, 1);
      const balanceAfter = await token.balanceOf(wallet.address);
      expect(balanceAfter).to.equal(balanceBefore.add(1));
    });
    it('should exit line', async () => {
      await join(wallet, expandTo18Decimals(1023));

      const balanceBefore = await token.balanceOf(wallet.address);
      await exit(wallet, expandTo18Decimals(1023));
      const balanceAfter = await token.balanceOf(wallet.address);
      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(1023)));
    });
    it('should exit on non-symmetric slot', async () => {
      await join(wallet, expandTo18Decimals(100));
      await operator.transfer(operator.address, expandTo18Decimals(75), expandTo18Decimals(50));

      const balanceBefore = await token.balanceOf(wallet.address);
      await operator.exit(wallet.address);
      const balanceAfter = await token.balanceOf(wallet.address);
      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(50)));
    });
    it('should exit when governor is active', async () => {
      await join(wallet, expandTo18Decimals(100));
      await propose(governor);

      const balanceBefore = await token.balanceOf(wallet.address);
      await exit(wallet, expandTo18Decimals(100));
      const balanceAfter = await token.balanceOf(wallet.address);
      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(100)));
    });
    it('should revert when exiting zero tokens', async () => {
      await expect(operator.exit(wallet.address)).to.be.revertedWith('0');
    });
    it('should emit an event', async () => {
      await join(wallet, expandTo18Decimals(100));
      await operator.transfer(operator.address, expandTo18Decimals(100), expandTo18Decimals(100));
      await expect(operator.exit(wallet.address))
        .to.emit(operator, 'Exited')
        .withArgs(wallet.address, wallet.address, expandTo18Decimals(100));
    });
  });

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
      await join(wallet, expandTo18Decimals(100), accumulator.address, wallet.address);
      await accumulator.stake(token.address, wallet.address);
      await propose(governor);

      await operator.transfer(accumulator.address, 0, expandTo18Decimals(100));
      await expect(operator.use(333, 1)).to.be.revertedWith('GovernorAlpha::state: invalid proposal id');
    });
    it('should revert when pid is old', async () => {
      await join(wallet, expandTo18Decimals(100), accumulator.address, wallet.address);
      await accumulator.stake(token.address, wallet.address);
      await propose(governor);
      await evmMiner(provider, (await operator.timeline(1))[3].toNumber() - (await provider.getBlockNumber()));

      await operator.transfer(accumulator.address, 0, expandTo18Decimals(100));
      await expect(operator.use(pid, 1)).to.be.revertedWith('OBS');
    });
    it('should revert when using zero', async () => {
      await join(wallet, expandTo18Decimals(100), accumulator.address, wallet.address);
      await accumulator.stake(token.address, wallet.address);
      await propose(governor);

      await expect(operator.use(pid, 1)).to.be.revertedWith('0');
    });
    it('should revert when nothing staked', async () => {
      await expect(operator.use(pid, 1)).to.be.reverted;
    });
    it('should revert when proposal is not created', async () => {
      await join(wallet, expandTo18Decimals(100), accumulator.address, accumulator.address);
      await accumulator.stake(token.address, wallet.address);
      await expect(operator.use(pid, 1)).to.be.revertedWith('E');
    });
    it('should emit an event', async () => {
      await join(wallet, expandTo18Decimals(100), accumulator.address, wallet.address);
      await accumulator.stake(token.address, wallet.address);
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

      it('f(0, 0) => (0, 0) | 0', async () => {
        await propose(governor);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('f(0.5, 0) => (0.5, 0) | 0.5', async () => {
        await propose(governor);
        await join(wallet, expandWithDecimals(5, 17));
        await stake(wallet, expandWithDecimals(5, 17));
        await use(wallet, expandWithDecimals(5, 17), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('f(0.9, 0) => (0.9, 0) | 0.9', async () => {
        await propose(governor);
        await join(wallet, expandWithDecimals(9, 17));
        await stake(wallet, expandWithDecimals(9, 17));
        await use(wallet, expandWithDecimals(9, 17), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('f(1, 0) => (1, 0) | 1', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(1));
        await stake(wallet, expandTo18Decimals(1));
        await use(wallet, expandTo18Decimals(1), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await operator.route(pid, 0);
      });
      it('f(1.1, 0) => (1.1, 0) | 1.1', async () => {
        await propose(governor);
        await join(wallet, expandWithDecimals(11, 17));
        await stake(wallet, expandWithDecimals(11, 17));
        await use(wallet, expandWithDecimals(11, 17), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await operator.route(pid, 0);
      });
      it('f(2, 0) => (2, 0) | 2', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(2));
        await stake(wallet, expandTo18Decimals(2));
        await use(wallet, expandTo18Decimals(2), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await operator.route(pid, 1); // 1
        await operator.route(pid, 0); // 1
      });
      it('f(3, 0) => (3, 0) | 3', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(3));
        await stake(wallet, expandTo18Decimals(3));
        await use(wallet, expandTo18Decimals(3), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await operator.route(pid, 1);
        await operator.route(pid, 0);
      });
      it('f(4, 0) => (4, 0) | 4', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(4));
        await stake(wallet, expandTo18Decimals(4));
        await use(wallet, expandTo18Decimals(4), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2); // 1
        await operator.route(pid, 1); // 2
        await operator.route(pid, 0); // 1
      });
      it('f(5, 0) => (5, 0) | 5', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(5));
        await stake(wallet, expandTo18Decimals(5));
        await use(wallet, expandTo18Decimals(5), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2); // 2
        await operator.route(pid, 1); // 2
        await operator.route(pid, 0); // 1
      });
      it('f(6, 0) => (6, 0) | 6', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(6));
        await stake(wallet, expandTo18Decimals(6));
        await use(wallet, expandTo18Decimals(6), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2); // 3
        await operator.route(pid, 1); // 2
        await operator.route(pid, 0); // 1
      });
      it('f(7, 0) => (7, 0) | 7', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await use(wallet, expandTo18Decimals(7), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2); // 4
        await operator.route(pid, 1); // 2
        await operator.route(pid, 0); // 1
      });
      it('f(8, 0) => (8, 0) | 7', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await use(wallet, expandTo18Decimals(7), pid, 1);
        await accumulator.collect(token.address, wallet.address, expandTo18Decimals(10));
        await use(wallet, expandTo18Decimals(1), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2); // 4
        await operator.route(pid, 1); // 2
        await operator.route(pid, 0); // 1
      });
      it('f(0, 0) => (0, 0) | 7', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('f(1, 0) => (1, 0) | 7', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await use(wallet, expandTo18Decimals(1), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await operator.route(pid, 0);
      });
      it('f(2, 0) => (2, 0) | 7', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await use(wallet, expandTo18Decimals(2), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await operator.route(pid, 1);
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('f(3, 0) => (3, 0) | 7', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await use(wallet, expandTo18Decimals(3), pid, 1);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await operator.route(pid, 1);
        await operator.route(pid, 0);
      });
      it('f(4, 0) => (4, 0) | 7', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await use(wallet, expandTo18Decimals(4), pid, 1);
        await timetravel(pid, 'start');

        await operator.route(pid, 2);
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
      it('f(7, 7) => (0, 0) | 7', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(7));
        await stake(wallet, expandTo18Decimals(7));
        await use(wallet, expandTo18Decimals(7), pid, 1);
        await accumulator.collect(token.address, wallet.address, expandTo18Decimals(10));
        await use(wallet, expandTo18Decimals(7), pid, 0);
        await timetravel(pid, 'start');

        await expect(operator.route(pid, 2)).to.be.revertedWith('F');
        await expect(operator.route(pid, 1)).to.be.revertedWith('F');
        await expect(operator.route(pid, 0)).to.be.revertedWith('F');
      });
    });

    describe('misc', async () => {
      beforeEach(async () => {
        await loadFixture(routeMiscFixture);
      });

      it('f(100, 0) => (100, 0) | 100', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(100));
        await stake(wallet, expandTo18Decimals(100));
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
      it('f(75, 0) => (75, 0) | 75', async () => {
        // route with 75 - filled 63 and excess 12 => 75.
        await propose(governor);
        await join(wallet, expandTo18Decimals(75));
        await stake(wallet, expandTo18Decimals(75));
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
      it('f(38, 0) => (38, 0) | 38', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(38));
        await stake(wallet, expandTo18Decimals(38));
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
      it('f(75, 0) => (75, 0) | 100', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(100));
        await stake(wallet, expandTo18Decimals(100));
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
      it('f(50, 25) => (50, 25) | 100', async () => {
        await propose(governor);
        await join(wallet, expandTo18Decimals(100));
        await stake(wallet, expandTo18Decimals(100));
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
