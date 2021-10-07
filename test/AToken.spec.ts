import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { erc20CompLikeFixture } from './shared/fixtures';
import { functions } from './shared/functions';
import { deploy, expandTo18Decimals, ROOT } from './shared/utils';
import { AToken, ERC20CompLike, Kernel, OperatorA, Sequencer } from '../typechain';

const { MaxUint256 } = ethers.constants;
const { loadFixture, provider } = waffle;

describe('AToken', async () => {
  let abi = new ethers.utils.AbiCoder();
  let wallet;
  let other1;

  let token: ERC20CompLike;
  let kernel: Kernel;
  let sequencer: Sequencer;
  let operator;
  let aToken: AToken;

  let read: Function;
  let join: Function;

  const fixture = async () => {
    ;([wallet, other1] = await ethers.getSigners());

    token = await erc20CompLikeFixture(provider, wallet);

    kernel = (await deploy('Kernel')) as Kernel;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', token.address, kernel.address)) as OperatorA;
    aToken = (await deploy('AToken', token.address, kernel.address)) as AToken;

    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, aToken.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [expandTo18Decimals(10000)])); 

    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(10);

    ({ read, join } = functions({ token, kernel, sequencer, operator }));
  };

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe('#constructor', async () => {
    it('should set name and symbol', async () => {
      expect(await aToken.name()).to.equal('Automata CompLike');
      expect(await aToken.symbol()).to.equal('aCL');
      expect(await aToken.decimals()).to.equal(18);
    });
  });

  describe('#mint', async () => {
    it('should mint', async () => {
      await join(wallet, aToken.address, null, expandTo18Decimals(100));
      expect((await read(token.address, aToken.address)).x).to.equal(expandTo18Decimals(100));
      expect((await read(token.address, aToken.address)).y).to.equal(0);
      expect((await read(token.address, wallet.address)).x).to.equal(0);
      expect((await read(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));
      
      // mint
      expect(await aToken.balanceOf(wallet.address)).to.equal(0);
      await aToken.mint(wallet.address);
      expect(await aToken.totalSupply()).to.equal(expandTo18Decimals(100));
      expect(await aToken.balanceOf(wallet.address)).to.equal(expandTo18Decimals(100));

      // mint again to see nothing happens
      await expect(aToken.mint(wallet.address)).to.be.revertedWith('0');
    });
    it('should revert when minting zero', async () => {
      await expect(aToken.mint(wallet.address)).to.be.revertedWith('0');
    });
    it('should emit an event', async () => {
      await join(wallet, aToken.address, null, expandTo18Decimals(100));
      await expect(aToken.mint(wallet.address))
        .to.emit(aToken, 'Transfer')
        .withArgs(ethers.constants.AddressZero, wallet.address, expandTo18Decimals(100));
    });
  });

  describe('#burn', async () => {
    it('should burn', async () => {
      // join & mint
      await join(wallet, aToken.address, null, expandTo18Decimals(100));
      await aToken.mint(wallet.address);
      expect(await aToken.totalSupply()).to.equal(expandTo18Decimals(100));
      expect(await aToken.balanceOf(wallet.address)).to.equal(expandTo18Decimals(100));

      // burn & join
      await aToken.transfer(aToken.address, expandTo18Decimals(100));
      await aToken.burn(wallet.address);
      expect((await read(token.address, aToken.address)).x).to.equal(0);
      expect((await read(token.address, aToken.address)).y).to.equal(0);
      expect((await read(token.address, wallet.address)).x).to.equal(expandTo18Decimals(100));
      expect((await read(token.address, wallet.address)).y).to.equal(expandTo18Decimals(100));

      // exit
      await operator.transfer(operator.address, expandTo18Decimals(100), expandTo18Decimals(100));
      await operator.exit(other1.address);
      expect(await token.balanceOf(other1.address)).to.equal(expandTo18Decimals(100));
    });
    it('should revert when burning zero', async () => {
      await expect(aToken.burn(wallet.address)).to.be.revertedWith('0');
    });
    it('should revert when no access to kernel', async () => {
      await join(wallet, aToken.address, null, expandTo18Decimals(100));
      await aToken.mint(wallet.address);
      expect(await aToken.totalSupply()).to.equal(expandTo18Decimals(100));
      expect(await aToken.balanceOf(wallet.address)).to.equal(expandTo18Decimals(100));

      // revoke role for aToken contract
      await kernel.revokeRole(ROOT, aToken.address);
      await aToken.transfer(aToken.address, expandTo18Decimals(100));
      await expect(aToken.burn(wallet.address)).to.be.revertedWith('Access denied');
    });
    it('should emit an event', async () => {
      await join(wallet, aToken.address, null, expandTo18Decimals(100));
      await aToken.mint(wallet.address);
      await aToken.transfer(aToken.address, expandTo18Decimals(100));
      await expect(aToken.burn(wallet.address))
        .to.emit(aToken, 'Transfer')
        .withArgs(aToken.address, ethers.constants.AddressZero, expandTo18Decimals(100));
    });
  });
});
