import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { erc20CompLikeFixture } from './shared/fixtures';
import { functions } from './shared/functions';
import { deploy, e18, ROOT } from './shared/utils';
import { VToken, ERC20CompLike, Kernel, OperatorA, Sequencer } from '../typechain';

const { MaxUint256 } = ethers.constants;
const { loadFixture, provider } = waffle;

describe('VToken', async () => {
  let abi = new ethers.utils.AbiCoder();
  let wallet;
  let other1;

  let token: ERC20CompLike;

  let kernel: Kernel;
  let sequencer: Sequencer;
  let operator;

  let vToken: VToken;

  let read: Function;
  let join: Function;

  const fixture = async () => {
    ;([wallet, other1] = await ethers.getSigners());

    token = await erc20CompLikeFixture(provider, wallet);

    kernel = (await deploy('Kernel')) as Kernel;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', token.address, kernel.address)) as OperatorA;
    vToken = (await deploy('VToken', token.address, kernel.address)) as VToken;

    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, vToken.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [e18(10000)])); 

    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(10);

    ({ read, join } = functions({ token, kernel, sequencer, operator }));
  };

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  describe('#constructor', async () => {
    it('should set name and symbol', async () => {
      expect(await vToken.name()).to.equal('Automata Voting CompLike');
      expect(await vToken.symbol()).to.equal('vCL');
      expect(await vToken.decimals()).to.equal(18);
    });
  });

  describe('#mint', async () => {
    it('should mint', async () => {
      await join(wallet, wallet.address, vToken.address, e18(100));
      expect((await read(token.address, vToken.address)).x).to.equal(0);
      expect((await read(token.address, vToken.address)).y).to.equal(e18(100));
      expect((await read(token.address, wallet.address)).x).to.equal(e18(100));
      expect((await read(token.address, wallet.address)).y).to.equal(0);
      
      // mint
      expect(await vToken.balanceOf(wallet.address)).to.equal(0);
      await vToken.mint(wallet.address);
      expect(await vToken.totalSupply()).to.equal(e18(100));
      expect(await vToken.balanceOf(wallet.address)).to.equal(e18(100));

      // mint again to see nothing happens
      await expect(vToken.mint(wallet.address)).to.be.revertedWith('0');
    });
    it('should revert when minting zero', async () => {
      await expect(vToken.mint(wallet.address)).to.be.revertedWith('0');
    });
    it('should emit an event', async () => {
      await join(wallet, wallet.address, vToken.address, e18(100));
      await expect(vToken.mint(wallet.address))
        .to.emit(vToken, 'Transfer')
        .withArgs(ethers.constants.AddressZero, wallet.address, e18(100));
    });
  });

  describe('#burn', async () => {
    it('should burn', async () => {
      // join & mint
      await join(wallet, wallet.address, vToken.address, e18(100));
      await vToken.mint(wallet.address);
      expect(await vToken.totalSupply()).to.equal(e18(100));
      expect(await vToken.balanceOf(wallet.address)).to.equal(e18(100));

      // burn & join
      await vToken.transfer(vToken.address, e18(100));
      await vToken.burn(wallet.address);
      expect((await read(token.address, vToken.address)).x).to.equal(0);
      expect((await read(token.address, vToken.address)).y).to.equal(0);
      expect((await read(token.address, wallet.address)).x).to.equal(e18(100));
      expect((await read(token.address, wallet.address)).y).to.equal(e18(100));

      // exit
      await operator.transfer(operator.address, e18(100), e18(100));
      await operator.exit(other1.address);
      expect(await token.balanceOf(other1.address)).to.equal(e18(100));
    });
    it('should revert when burning zero', async () => {
      await expect(vToken.burn(wallet.address)).to.be.revertedWith('0');
    });
    it('should revert when no access to kernel', async () => {
      await join(wallet, wallet.address, vToken.address, e18(100));
      await vToken.mint(wallet.address);
      expect(await vToken.totalSupply()).to.equal(e18(100));
      expect(await vToken.balanceOf(wallet.address)).to.equal(e18(100));

      // revoke role for vToken contract
      await kernel.revokeRole(ROOT, vToken.address);
      await vToken.transfer(vToken.address, e18(100));
      await expect(vToken.burn(wallet.address)).to.be.revertedWith('Access denied');
    });
    it('should emit an event', async () => {
      await join(wallet, wallet.address, vToken.address, e18(100));
      await vToken.mint(wallet.address);
      await vToken.transfer(vToken.address, e18(100));
      await expect(vToken.burn(wallet.address))
        .to.emit(vToken, 'Transfer')
        .withArgs(vToken.address, ethers.constants.AddressZero, e18(100));
    });
  });
});
