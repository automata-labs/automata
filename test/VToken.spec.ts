import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { erc20CompLikeFixture } from './shared/fixtures';
import { functions } from './shared/functions';
import { deploy, expandTo18Decimals, ROOT } from './shared/utils';
import { VToken, ERC20CompLike, Kernel, OperatorA, Sequencer } from '../typechain';

const { MaxUint256 } = ethers.constants;
const { loadFixture, provider } = waffle;

describe('VToken', async () => {
  let abi = new ethers.utils.AbiCoder();
  let wallet;
  let other1;
  let other2;

  let token: ERC20CompLike;

  let kernel: Kernel;
  let sequencer: Sequencer;
  let operator;

  let vToken: VToken;

  let read: Function;
  let join: Function;

  const fixture = async () => {
    ;([wallet, other1, other2] = await ethers.getSigners());

    token = await erc20CompLikeFixture(provider, wallet);

    kernel = (await deploy('Kernel')) as Kernel;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', kernel.address, token.address)) as OperatorA;
    vToken = (await deploy('VToken', kernel.address, token.address, "VToken", "ATOK")) as VToken;

    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, vToken.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [expandTo18Decimals(10000)])); 

    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(10);

    ({ read, join } = functions({ token, kernel, sequencer, operator }));
  };

  const mintFixture = async () => {
    await fixture();
  };

  const burnFixture = async () => {
    await fixture();
  };

  describe('#mint', async () => {
    beforeEach(async () => {
      await loadFixture(mintFixture);
    });

    it('should mint', async () => {
      await join(wallet, expandTo18Decimals(100), wallet.address, vToken.address);
      expect((await read(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await read(token.address, wallet.address)).y).to.equal(0);
      expect((await read(token.address, vToken.address)).x).to.equal(0);
      expect((await read(token.address, vToken.address)).y).to.equal(expandTo18Decimals(100));
      
      // mint
      expect(await vToken.balanceOf(wallet.address)).to.equal(0);
      await vToken.mint(wallet.address);
      expect(await vToken.totalSupply()).to.equal(expandTo18Decimals(100));
      expect(await vToken.balanceOf(wallet.address)).to.equal(expandTo18Decimals(100));

      // mint again to see nothing happens
      await expect(vToken.mint(wallet.address)).to.be.revertedWith('0');
    });
    it('should revert when minting zero', async () => {
      await expect(vToken.mint(wallet.address)).to.be.revertedWith('0');
    });
    it('should emit an event', async () => {
      await join(wallet, expandTo18Decimals(100), wallet.address, vToken.address);
      await expect(vToken.mint(wallet.address))
        .to.emit(vToken, 'Transfer')
        .withArgs(ethers.constants.AddressZero, wallet.address, expandTo18Decimals(100));
    });
  });

  describe('#burn', async () => {
    beforeEach(async () => {
      await loadFixture(burnFixture);
    });

    it('should burn', async () => {
      // join & mint
      await join(wallet, expandTo18Decimals(100), wallet.address, vToken.address);
      await vToken.mint(wallet.address);
      expect(await vToken.totalSupply()).to.equal(expandTo18Decimals(100));
      expect(await vToken.balanceOf(wallet.address)).to.equal(expandTo18Decimals(100));

      // burn & join
      await vToken.transfer(vToken.address, expandTo18Decimals(100));
      await vToken.burn(wallet.address);
      expect((await read(token.address, vToken.address)).x).to.equal(0);
      expect((await read(token.address, vToken.address)).y).to.equal(0);
      expect((await read(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await read(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));

      // exit
      await operator.transfer(operator.address, expandTo18Decimals(100), expandTo18Decimals(100));
      await operator.exit(other1.address);
      expect(await token.balanceOf(other1.address)).to.equal(expandTo18Decimals(100));
    });
    it('should revert when burning zero', async () => {
      await expect(vToken.burn(wallet.address)).to.be.revertedWith('0');
    });
    it('should emit an event', async () => {
      await join(wallet, expandTo18Decimals(100), wallet.address, vToken.address);
      await vToken.mint(wallet.address);
      await vToken.transfer(vToken.address, expandTo18Decimals(100));
      await expect(vToken.burn(wallet.address))
        .to.emit(vToken, 'Transfer')
        .withArgs(vToken.address, ethers.constants.AddressZero, expandTo18Decimals(100));
    });
  });
});
