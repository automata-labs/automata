import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { Accumulator, ERC20CompLike, GovernorAlphaMock, Kernel, Linear, OperatorA, Sequencer } from '../typechain';
import { erc20CompLikeFixture, governorAlphaFixture } from './shared/fixtures';
import { deploy, expandTo18Decimals, MAX_UINT256, mineBlocks, ROOT } from './shared/utils';

const { BigNumber } = ethers;
const { createFixtureLoader, provider } = waffle;

describe('OperatorA', async () => {
  let abi = new ethers.utils.AbiCoder();
  let loadFixture;
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

  const read = (tokenAddr, walletAddr) => {
    return kernel.read(ethers.utils.keccak256(abi.encode(['address', 'address'], [tokenAddr, walletAddr])));
  };

  const join = async (caller, tox, toy, amount) => {
    await token.connect(caller).transfer(sequencer.address, amount);
    await operator.join(tox, toy);
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

  const fixture = async () => {
    token = await erc20CompLikeFixture(provider, wallet);
    ;({ governor } = await governorAlphaFixture(provider, token, wallet));

    kernel = (await deploy('Kernel')) as Kernel;
    accumulator = (await deploy('Accumulator', kernel.address)) as Accumulator;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', kernel.address, token.address)) as OperatorA;
    linear = (await deploy('Linear')) as Linear;
  };

  const joinFixture = async () => {
    await fixture();

    await token.approve(operator.address, MAX_UINT256);
    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, operator.address);

    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governor.address]));
  };

  const exitFixture = async () => {
    await joinFixture();

    await token.transfer(sequencer.address, expandTo18Decimals(100));
    await operator.join(wallet.address, wallet.address);
  };

  const choiceFixture = async () => {
    await fixture();

    await token.approve(operator.address, MAX_UINT256);
    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, operator.address);

    await operator.set(operator.interface.getSighash('accumulator'), abi.encode(['address'], [accumulator.address]));
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governor.address]));
    await operator.set(operator.interface.getSighash('period'), abi.encode(['uint32'], [80]));
    await operator.set(operator.interface.getSighash('computer'), abi.encode(['address'], [linear.address]));
  };

  const routeFixture = async () => {
    await choiceFixture();
  };

  before('fixture loader', async () => {
    ;([wallet, other1, other2] = await ethers.getSigners());
    loadFixture = createFixtureLoader([wallet]);
  });

  describe('#join', async () => {
    beforeEach(async () => {
      await loadFixture(joinFixture);
    });

    it('should join', async () => {
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
    });
    it('should join multiple times', async () => {
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(500));
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(510), expandTo18Decimals(510)]);
    });
    it('should join zero tokens', async () => {
      await operator.join(wallet.address, wallet.address);
    });
    it('should join dust', async () => {
      await join(wallet, wallet.address, wallet.address, 1);
      expect(await read(token.address, wallet.address)).to.eql([BigNumber.from(1), BigNumber.from(1)]);
    });
    it.skip('should join line', async () => {});
    it.skip('should join with different accounts', async () => {});
    it('should join to another accounts', async () => {
      await join(wallet, other1.address, other2.address, expandTo18Decimals(10));
      expect(await read(token.address, other1.address)).to.eql([expandTo18Decimals(10), BigNumber.from(0)]);
      expect(await read(token.address, other2.address)).to.eql([BigNumber.from(0), expandTo18Decimals(10)]);
    });
    it('should join to a slot with non-symmetric values', async () => {
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(100));
      await operator.transfer(other1.address, expandTo18Decimals(25), expandTo18Decimals(75));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(75), expandTo18Decimals(25)]);
      expect(await read(token.address, other1.address)).to.eql([expandTo18Decimals(25), expandTo18Decimals(75)]);

      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(100));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(175), expandTo18Decimals(125)]);
    });
    it('should join when governor not active', async () => {
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
    });
    it('should join when governor active but observe is false', async () => {
      await operator.set(operator.interface.getSighash('observe'), abi.encode(['bool'], [false]));
      await propose(governor);
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(10));
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
    });
    it.skip('should emit an event', async () => {});
    it.skip('should revert when join on zero shards', async () => {});
    it('should revert when governor is active', async () => {
      await propose(governor);

      await token.transfer(sequencer.address, expandTo18Decimals(10));
      await expect(operator.join(wallet.address, wallet.address)).to.be.revertedWith('OBS');
      await mineBlocks(provider, (await governor.votingPeriod()).toNumber());
      await operator.join(wallet.address, wallet.address);
      expect(await read(token.address, wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
    });
    it.skip('should revert when overflowing sequencer space', async () => {});
  });

  describe('#exit', async () => {
    beforeEach(async () => {
      await loadFixture(exitFixture);
    });

    it('should exit', async () => {
      const balanceBefore = await token.balanceOf(wallet.address);
      await operator.transfer(operator.address, expandTo18Decimals(10), expandTo18Decimals(10));
      await operator.exit(wallet.address);
      const balanceAfter = await token.balanceOf(wallet.address);

      expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));
    });
    it.skip('should exit multiple times', async () => {});
    it.skip('should exit with different accounts', async () => {});
    it.skip('should exit to another account', async () => {});
    it.skip('should exit dust', async () => {});
    it.skip('should exit line', async () => {});
    it.skip('should exit on non-symmetric slot', async () => {});
    it.skip('should exit when governor is active', async () => {});
    it.skip('should emit an event', async () => {});
    it.skip('should revert when exiting zero tokens', async () => {});
    it.skip('should revert when exiting on zero shards', async () => {});
    it.skip('should revert when underflowing sequencer space', async () => {});
  });

  describe('#use', async () => {
    beforeEach(async () => {
      await loadFixture(choiceFixture);
    });

    it('should use', async () => {
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(100));
      await operator.transfer(accumulator.address, expandTo18Decimals(100), 0);
      await accumulator.stake(token.address, wallet.address);
      
      await propose(governor);
      
      await operator.transfer(accumulator.address, 0, expandTo18Decimals(100));
      await operator.use(1, 1);
      expect((await operator.votes(1)).x).to.equal(expandTo18Decimals(100));
      expect((await operator.votes(1)).y).to.equal(0);
    });
    it('should revert when nothing staked', async () => {
      await expect(operator.use(1, 1)).to.be.reverted;
    })
    it('should revert when proposal is not created', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await expect(operator.use(1, 1)).to.be.revertedWith('E');
    });
    it('should revert when zero', async () => {
      await join(wallet, wallet.address, wallet.address, expandTo18Decimals(100));
      await operator.transfer(accumulator.address, expandTo18Decimals(100), 0);
      await accumulator.stake(token.address, wallet.address);
      
      await propose(governor);
      
      await expect(operator.use(1, 1)).to.be.revertedWith('0');
    });
  });

  describe('#route', async () => {
    beforeEach(async () => {
      await loadFixture(routeFixture);
    });

    it('should route with all (100)', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await propose(governor);
      await operator.use(1, 1);

      await mineBlocks(
        provider,
        (await operator.timeline(1))[2].toNumber() - (await provider.getBlockNumber())
      );

      await expect(operator.route(1, 10)).to.be.revertedWith('F0');
      await expect(operator.route(1, 9)).to.be.revertedWith('F0');
      await expect(operator.route(1, 8)).to.be.revertedWith('F0');
      await expect(operator.route(1, 7)).to.be.revertedWith('F0');
      await operator.route(1, 6);
      await operator.route(1, 5);
      await operator.route(1, 4);
      await operator.route(1, 3);
      await operator.route(1, 2);
      await operator.route(1, 1);
      await operator.route(1, 0);
    });
    it('should route with all (75)', async () => {
      // route with 75, with excess of 12.
      // we allow route with cursor, and then we have 63 left.
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(75));
      await accumulator.stake(token.address, wallet.address);
      await propose(governor);
      await operator.use(1, 1);

      await mineBlocks(
        provider,
        (await operator.timeline(1))[2].toNumber() - (await provider.getBlockNumber())
      );

      await expect(operator.route(1, 10)).to.be.revertedWith('F0');
      await expect(operator.route(1, 9)).to.be.revertedWith('F0');
      await expect(operator.route(1, 8)).to.be.revertedWith('F0');
      await expect(operator.route(1, 7)).to.be.revertedWith('F0');
      await operator.route(1, 6);
      await operator.route(1, 5);
      await operator.route(1, 4);
      await operator.route(1, 3);
      await operator.route(1, 2);
      await operator.route(1, 1);
      await operator.route(1, 0);
    });
    it('should route with all (38)', async () => {
      await join(wallet, accumulator.address, accumulator.address, expandTo18Decimals(38));
      await accumulator.stake(token.address, wallet.address);
      await propose(governor);
      await operator.use(1, 1);

      await mineBlocks(
        provider,
        (await operator.timeline(1))[2].toNumber() - (await provider.getBlockNumber())
      );

      await expect(operator.route(1, 10)).to.be.revertedWith('F0');
      await expect(operator.route(1, 9)).to.be.revertedWith('F0');
      await expect(operator.route(1, 8)).to.be.revertedWith('F0');
      await expect(operator.route(1, 7)).to.be.revertedWith('F0');
      await expect(operator.route(1, 6)).to.be.revertedWith('F0');
      await operator.route(1, 5);
      await operator.route(1, 4);
      await operator.route(1, 3);
      await operator.route(1, 2);
      await operator.route(1, 1);
      await operator.route(1, 0);
    });
    it('should route with 75 out of 100', async () => {
      await join(wallet, accumulator.address, wallet.address, expandTo18Decimals(100));
      await accumulator.stake(token.address, wallet.address);
      await propose(governor);
      await operator.transfer(accumulator.address, 0, expandTo18Decimals(75));
      await operator.use(1, 1);

      await mineBlocks(
        provider,
        (await operator.timeline(1))[2].toNumber() - (await provider.getBlockNumber())
      );

      await expect(operator.route(1, 10)).to.be.revertedWith('F0');
      await expect(operator.route(1, 9)).to.be.revertedWith('F0');
      await expect(operator.route(1, 8)).to.be.revertedWith('F0');
      await expect(operator.route(1, 7)).to.be.revertedWith('F0');
      await operator.route(1, 6);
      await operator.route(1, 5);
      await expect(operator.route(1, 4)).to.be.revertedWith('F0');
      await expect(operator.route(1, 3)).to.be.revertedWith('F0');
      await operator.route(1, 2)
      await operator.route(1, 1);
      await expect(operator.route(1, 0)).to.be.revertedWith('F0');
    });
  });
});
