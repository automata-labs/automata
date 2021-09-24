import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { AToken, ERC20CompLike, Kernel, OperatorA, Sequencer } from '../typechain';
import { erc20CompLikeFixture } from './shared/fixtures';
import { deploy, expandTo18Decimals, MAX_UINT256, ROOT } from './shared/utils';

const { createFixtureLoader, provider } = waffle;

describe('AToken', async () => {
  let abi = new ethers.utils.AbiCoder();
  let loadFixture;
  let wallet;
  let other1;
  let other2;

  let token: ERC20CompLike;

  let kernel: Kernel;
  let sequencer: Sequencer;
  let operator;

  let aToken: AToken;

  const read = (tokenAddr, walletAddr) => {
    return kernel.read(ethers.utils.keccak256(abi.encode(['address', 'address'], [tokenAddr, walletAddr])));
  };

  const join = async (caller, tox, toy, amount) => {
    await token.connect(caller).transfer(sequencer.address, amount);
    await operator.join(tox, toy);
  };

  const fixture = async () => {
    token = await erc20CompLikeFixture(provider, wallet);

    kernel = (await deploy('Kernel')) as Kernel;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', kernel.address, token.address)) as OperatorA;
    aToken = (await deploy('AToken', kernel.address, token.address, "AToken", "ATOK")) as AToken;

    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, aToken.address);
    await sequencer.grantRole(ROOT, operator.address);
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [expandTo18Decimals(10000)])); 

    await token.approve(sequencer.address, MAX_UINT256);
    await sequencer.clones(10);
  };

  const mintFixture = async () => {
    await fixture();
  };

  const burnFixture = async () => {
    await fixture();
  };

  before('fixture loader', async () => {
    ;([wallet, other1, other2] = await ethers.getSigners());
    loadFixture = createFixtureLoader([wallet]);
  });

  describe('#mint', async () => {
    beforeEach(async () => {
      await loadFixture(mintFixture);
    });

    it('should mint', async () => {
      await join(wallet, aToken.address, wallet.address, expandTo18Decimals(100));
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
      await aToken.mint(wallet.address);
      expect(await aToken.totalSupply()).to.equal(expandTo18Decimals(100));
      expect(await aToken.balanceOf(wallet.address)).to.equal(expandTo18Decimals(100));
    });
  });

  describe('#burn', async () => {
    beforeEach(async () => {
      await loadFixture(burnFixture);
    });

    it('should burn', async () => {
      // join & mint
      await join(wallet, aToken.address, wallet.address, expandTo18Decimals(100));
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
  });
});
