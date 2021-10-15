import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { erc20CompLikeFixture, governorAlphaFixture } from './shared/fixtures';
import {
  deploy,
  e18,
  getPermitNFTSignature,
  getPermitSignatureWithoutVersion,
  ROOT,
} from './shared/utils';
import {
  Accumulator,
  Application,
  ERC20CompLike,
  GovernorAlphaMock,
  Kernel,
  Linear,
  OperatorA,
  Sequencer,
  VToken,
} from '../typechain';
import { functions } from './shared/functions';

const { MaxUint256 } = ethers.constants;
const { loadFixture, provider } = waffle;

describe('Application', async () => {
  let abi = new ethers.utils.AbiCoder();
  let wallet;
  let other1;

  let token: ERC20CompLike;
  let governor: GovernorAlphaMock;

  let kernel: Kernel;
  let accumulator: Accumulator;
  let sequencer: Sequencer;
  let operator: OperatorA;
  let linear: Linear;
  let vToken: VToken;

  let application: Application;

  let propose;

  const mint = async (caller, to, amount) => {
    await application.connect(caller).mint({
      token: token.address,
      sequencer: sequencer.address,
      operator: operator.address,
      accumulator: accumulator.address,
      vToken: vToken.address,
      to,
      amount,
    });

    return (await accumulator.next()).toNumber() - 1;
  };

  const grow = async (caller, id, to, amount) => {
    await application.connect(caller).grow({
      id,
      token: token.address,
      sequencer: sequencer.address,
      operator: operator.address,
      accumulator: accumulator.address,
      vToken: vToken.address,
      to,
      amount,
    });
  };

  const burn = async (caller, id, to, amount) => {
    await application.connect(caller).burn({
      id,
      sequencer: sequencer.address,
      operator: operator.address,
      accumulator: accumulator.address,
      vToken: vToken.address,
      to,
      amount,
    });
  };

  const fixture = async () => {
    [wallet, other1] = await provider.getWallets();

    token = await erc20CompLikeFixture(provider, wallet);
    ({ governor } = await governorAlphaFixture(provider, token, wallet));

    kernel = (await deploy('Kernel')) as Kernel;
    accumulator = (await deploy('Accumulator', kernel.address)) as Accumulator;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', token.address, kernel.address)) as OperatorA;
    linear = (await deploy('Linear')) as Linear;
    vToken = (await deploy('VToken', token.address, kernel.address)) as VToken;

    application = (await deploy('Application')) as Application;

    // setup
    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, accumulator.address);
    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, vToken.address);
    await sequencer.grantRole(ROOT, operator.address);

    await operator.set(operator.interface.getSighash('accumulator'), abi.encode(['address'], [accumulator.address]));
    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governor.address]));
    await operator.set(operator.interface.getSighash('period'), abi.encode(['uint32'], [20]));
    await operator.set(operator.interface.getSighash('computer'), abi.encode(['address'], [linear.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [e18(10000)]));

    ({ propose } = functions({ token, kernel, accumulator, sequencer, operator }));
  };

  const permitFixture = async () => {
    await fixture();
  };

  const mintFixture = async () => {
    await fixture();

    await token.approve(application.address, MaxUint256);
  };

  const growFixture = async () => {
    await fixture();

    await token.approve(application.address, MaxUint256);
    await mint(wallet, wallet.address, 0);
  };

  const burnFixture = async () => {
    await fixture();

    await token.approve(application.address, MaxUint256);
    await vToken.approve(application.address, MaxUint256);
  };

  const voteFixture = async () => {
    await fixture();

    await token.approve(application.address, MaxUint256);
    await vToken.approve(application.address, MaxUint256);
  };

  describe('#permit', async () => {
    beforeEach(async () => {
      await loadFixture(permitFixture);
    });
    
    it('should permit', async () => {
      const { v, r, s } = await getPermitSignatureWithoutVersion(wallet, token, application.address, 1);

      expect(await token.allowance(wallet.address, application.address)).to.be.eq(0);
      await token.permit(wallet.address, application.address, 1, MaxUint256, v, r, s);
      expect(await token.allowance(wallet.address, application.address)).to.be.eq(1);
    });
  });

  describe('#mint', async () => {
    beforeEach(async () => {
      await loadFixture(mintFixture);
    });

    it('should mint', async () => {
      const id = await accumulator.next();
      await mint(wallet, wallet.address, 1);

      expect(await sequencer.liquidity()).to.equal(1);
      expect(await vToken.balanceOf(wallet.address)).to.equal(1);
      expect(await accumulator.balanceOf(wallet.address)).to.equal(1);
      expect(await accumulator.ownerOf(id)).to.equal(wallet.address);
    });
    it('should mint with permit', async () => {
      const id = await accumulator.next();
      const { v, r, s } = await getPermitSignatureWithoutVersion(wallet, token, application.address, 1);
      await application.multicall([
        application.interface.encodeFunctionData('selfPermitIfNecessary', [token.address, 1, MaxUint256, v, r, s]),
        application.interface.encodeFunctionData('mint', [{
          token: token.address,
          sequencer: sequencer.address,
          operator: operator.address,
          accumulator: accumulator.address,
          vToken: vToken.address,
          to: wallet.address,
          amount: 1,
        }])
      ]);

      expect(await sequencer.liquidity()).to.equal(1);
      expect(await vToken.balanceOf(wallet.address)).to.equal(1);
      expect(await accumulator.balanceOf(wallet.address)).to.equal(1);
      expect(await accumulator.ownerOf(id)).to.equal(wallet.address);
    });
    it('should mint with zero (nft only)', async () => {
      await mint(wallet, wallet.address, 0);
    });
    it('should mint to max capacity', async () => {
      const id = await accumulator.next();
      await mint(wallet, wallet.address, e18(1023));

      expect(await sequencer.liquidity()).to.equal(e18(1023));
      expect(await sequencer.capacity()).to.equal(0);
      expect(await vToken.balanceOf(wallet.address)).to.equal(e18(1023));
      expect(await accumulator.balanceOf(wallet.address)).to.equal(1);
      expect(await accumulator.ownerOf(id)).to.equal(wallet.address);
    });
    it('should revert when minting overflows in sequencer', async () => {
      await expect(
        mint(wallet, wallet.address, e18(1023).add(1))
      ).to.be.revertedWith('OVF');
    });
    it('should revert when insufficient balance of caller', async () => {
      await expect(mint(other1, other1.address, 1)).to.be.revertedWith('STF');
    });
    it('should revert when coin not approved', async () => {
      await token.approve(application.address, 0);
      await expect(mint(wallet, wallet.address, 1)).to.be.revertedWith('STF');
    });
    it('should revert when any contract passed in parameters is invalid', async () => {
      for (let i = 0; i < 5; i++) {
        await expect(
          application.mint({
            token: i == 0 ? wallet.address : token.address,
            sequencer: i == 1 ? wallet.address : sequencer.address,
            operator: i == 2 ? wallet.address : operator.address,
            accumulator: i == 3 ? wallet.address : accumulator.address,
            vToken: i == 4 ? wallet.address : vToken.address,
            to: wallet.address,
            amount: 1,
          })
        ).to.be.reverted;
      }
    });
  });

  describe('#grow', async () => {
    beforeEach(async () => {
      await loadFixture(growFixture);
    });
      
    it('should grow', async () => {
      const id = (await accumulator.next()).toNumber() - 1;
      await grow(wallet, id, wallet.address, 1);

      expect(await sequencer.liquidity()).to.equal(1);
      expect(await vToken.balanceOf(wallet.address)).to.equal(1);
      expect(await accumulator.balanceOf(wallet.address)).to.equal(1);
      expect(await accumulator.ownerOf(id)).to.equal(wallet.address);
    });
    it('should revert when growing zero', async () => {
      const id = (await accumulator.next()).toNumber() - 1;
      await expect(grow(wallet, id, wallet.address, 0)).to.be.revertedWith('0');
    });
    it('should revert when invalid id', async () => {

    });
    it('should revert when any contract passed in parameters is invalid', async () => {
      const id = (await accumulator.next()).toNumber() - 1;

      for (let i = 0; i < 5; i++) {
        await expect(
          application.grow({
            id,
            token: i == 0 ? wallet.address : token.address,
            sequencer: i == 1 ? wallet.address : sequencer.address,
            operator: i == 2 ? wallet.address : operator.address,
            accumulator: i == 3 ? wallet.address : accumulator.address,
            vToken: i == 4 ? wallet.address : vToken.address,
            to: wallet.address,
            amount: 1,
          })
        ).to.be.reverted;
      }
    });
  });

  describe('#burn', async () => {
    beforeEach(async () => {
      await loadFixture(burnFixture);
    });

    it('should burn', async () => {
      const id = await accumulator.next();
      await mint(wallet, wallet.address, 1);
      await accumulator.approve(application.address, id);

      await burn(wallet, id, wallet.address, 1);
    });
    it('should burn with permit', async () => {
      const id = await accumulator.next();
      await mint(wallet, wallet.address, 2);

      expect(await accumulator.getApproved(id)).to.equal(ethers.constants.AddressZero);
      const { v, r, s } = await getPermitNFTSignature(wallet, accumulator, application.address, id, MaxUint256);
      await application.multicall([
        application.interface.encodeFunctionData('selfPermitERC721', [accumulator.address, id, MaxUint256, v, r, s]),
        application.interface.encodeFunctionData('burn', [{
          id,
          sequencer: sequencer.address,
          operator: operator.address,
          accumulator: accumulator.address,
          vToken: vToken.address,
          to: wallet.address,
          amount: 1,
        }])
      ]);

      expect(await accumulator.getApproved(id)).to.equal(application.address);
      expect(await sequencer.liquidity()).to.equal(1);
      expect(await vToken.balanceOf(wallet.address)).to.equal(1);
      expect(await accumulator.balanceOf(wallet.address)).to.equal(1);
      expect(await accumulator.ownerOf(id)).to.equal(wallet.address);
    });
    it('should revert when burning more than balance', async () => {
      const id = await accumulator.next();
      await mint(wallet, wallet.address, 1);
      await accumulator.approve(application.address, id);

      await expect(burn(wallet, id, wallet.address, 2)).to.be.revertedWith('STF');
    });
    it('should revert when burning zero', async () => {
      const id = (await accumulator.next()).toNumber() - 1;
      await expect(burn(wallet, id, wallet.address, 0)).to.be.revertedWith('0');
    });
    it('should revert when any contract passed in parameters is invalid', async () => {
      const id = (await accumulator.next()).toNumber() - 1;

      for (let i = 0; i < 4; i++) {
        await expect(
          application.burn({
            id,
            sequencer: i == 0 ? wallet.address : sequencer.address,
            operator: i == 1 ? wallet.address : operator.address,
            accumulator: i == 2 ? wallet.address : accumulator.address,
            vToken: i == 3 ? wallet.address : vToken.address,
            to: wallet.address,
            amount: 1,
          })
        ).to.be.reverted;
      }
    });
  });

  describe('#vote', async () => {
    beforeEach(async () => {
      await loadFixture(voteFixture);
    });

    it('should vote', async () => {
      await mint(wallet, wallet.address, 1);
      await propose(wallet, governor);
      const pid = await governor.proposalCount();

      await application.vote({
        operator: operator.address,
        accumulator: accumulator.address,
        vToken: vToken.address,
        pid,
        support: 1,
        amount: 1,
      });

      expect((await operator.votes(pid)).x).to.equal(1);
      expect((await operator.votes(pid)).y).to.equal(0);
    });
  });
});
