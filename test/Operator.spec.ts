import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { erc20CompLikeFixture, governorAlphaFixture } from './shared/fixtures';
import { functions } from './shared/functions';
import {
  deploy,
  expandTo18Decimals,
  evmMiner,
  ROOT,
} from './shared/utils';
import {
  ERC20CompLike,
  GovernorAlphaMock,
  Kernel,
  OperatorMock,
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
  let sequencer: Sequencer;
  let operator: OperatorMock;

  let propose: Function;
  let read: Function;
  let join: Function;
  let exit: Function;

  const fixture = async () => {
    [wallet, other1, other2] = await provider.getWallets();

    token = await erc20CompLikeFixture(provider, wallet);
    ({ governor } = await governorAlphaFixture(provider, token, wallet));

    kernel = (await deploy('Kernel')) as Kernel;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', kernel.address, token.address)) as OperatorMock;

    ({ propose, read, join, exit } = functions({ token, kernel, operator, sequencer }));
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
    it('should join when governor active and observe is false', async () => {
      await operator.set(operator.interface.getSighash('observe'), abi.encode(['bool'], [false]));
      await propose(wallet, governor);
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
      await propose(wallet, governor);

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
      await propose(wallet, governor);

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

  describe('#transfer', async () => {
    it('should transfer', async () => {});
  });
});
