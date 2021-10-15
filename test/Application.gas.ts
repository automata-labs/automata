import { use } from 'chai';
import { ethers, waffle } from 'hardhat';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';

import { erc20CompLikeFixture, governorAlphaFixture } from './shared/fixtures';
import {
  deploy,
  e18,
  getPermitNFTSignature,
  getPermitSignature,
  getPermitSignatureWithoutVersion,
  ROOT,
  snapshotGasCost,
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

use(jestSnapshotPlugin());

const { MaxUint256 } = ethers.constants;
const { loadFixture, provider } = waffle;

describe('Application.gas', async () => {
  let abi = new ethers.utils.AbiCoder();
  let wallet;
  let holder;

  let token: ERC20CompLike;
  let governor: GovernorAlphaMock;

  let kernel: Kernel;
  let accumulator: Accumulator;
  let sequencer: Sequencer;
  let operator: OperatorA;
  let linear: Linear;
  let vToken: VToken;

  let application: Application;

  const fixture = async () => {
    [wallet, holder] = await provider.getWallets();

    token = await erc20CompLikeFixture(provider, wallet);
    ({ governor } = await governorAlphaFixture(provider, token, wallet));

    kernel = (await deploy('Kernel')) as Kernel;
    accumulator = (await deploy('Accumulator', kernel.address)) as Accumulator;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
    operator = (await deploy('OperatorA', token.address, kernel.address)) as OperatorA;
    linear = (await deploy('Linear')) as Linear;
    vToken = (await deploy('VToken', token.address, kernel.address)) as VToken;

    application = (await deploy('Application')) as Application;
  };

  const mintFixture = async () => {
    await fixture();

    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, operator.address);
    await sequencer.grantRole(ROOT, operator.address);

    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governor.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [e18(10000)]));
  };

  const burnFixture = async () => {
    await fixture();

    await token.approve(sequencer.address, MaxUint256);
    await sequencer.clones(10);

    await kernel.grantRole(ROOT, accumulator.address);
    await kernel.grantRole(ROOT, operator.address);
    await kernel.grantRole(ROOT, vToken.address);
    await sequencer.grantRole(ROOT, operator.address);

    await operator.set(operator.interface.getSighash('sequencer'), abi.encode(['address'], [sequencer.address]));
    await operator.set(operator.interface.getSighash('governor'), abi.encode(['address'], [governor.address]));
    await operator.set(operator.interface.getSighash('limit'), abi.encode(['uint256'], [e18(10000)]));
  };

  describe('#mint', async () => {
    beforeEach(async () => {
      await loadFixture(mintFixture);
    });

    it('gas first mint', async () => {
      await token.approve(application.address, MaxUint256);
      await snapshotGasCost(
        application.mint({
          token: token.address,
          sequencer: sequencer.address,
          operator: operator.address,
          accumulator: accumulator.address,
          vToken: vToken.address,
          to: wallet.address,
          amount: 1,
        })
      );
    });

    it('gas mint', async () => {
      await token.approve(application.address, MaxUint256);
      await application.mint({
        token: token.address,
        sequencer: sequencer.address,
        operator: operator.address,
        accumulator: accumulator.address,
        vToken: vToken.address,
        to: wallet.address,
        amount: 1,
      });
      await token.transfer(holder.address, 2); // 2 to not clear slot when transferring 1

      await token.connect(holder).approve(application.address, MaxUint256);
      await snapshotGasCost(
        application.connect(holder).mint({
          token: token.address,
          sequencer: sequencer.address,
          operator: operator.address,
          accumulator: accumulator.address,
          vToken: vToken.address,
          to: wallet.address,
          amount: 1,
        })
      );
    });

    it('gas mint with permit', async () => {
      await token.approve(application.address, MaxUint256);
      await application.mint({
        token: token.address,
        sequencer: sequencer.address,
        operator: operator.address,
        accumulator: accumulator.address,
        vToken: vToken.address,
        to: wallet.address,
        amount: 1,
      });
      await token.transfer(holder.address, 2); // 2 to not clear slot when transferring 1

      const { v, r, s } = await getPermitSignatureWithoutVersion(holder, token, application.address, 1);
      await snapshotGasCost(
        application.connect(holder).multicall([
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
        ])
      );
    });
  });

  describe('#burn', async () => {
    beforeEach(async () => {
      await loadFixture(burnFixture);
    });

    it('gas burn with permit', async () => {
      const id = await accumulator.next();
      await token.approve(application.address, MaxUint256);
      await application.mint({
        token: token.address,
        sequencer: sequencer.address,
        operator: operator.address,
        accumulator: accumulator.address,
        vToken: vToken.address,
        to: wallet.address,
        amount: 2,
      });

      const { v: v_, r: r_, s: s_ } = await getPermitSignature(wallet, vToken, application.address, 1, MaxUint256);
      const { v, r, s } = await getPermitNFTSignature(wallet, accumulator, application.address, id, MaxUint256);
      await snapshotGasCost(
        application.multicall([
          application.interface.encodeFunctionData('selfPermit', [vToken.address, 1, MaxUint256, v_, r_, s_]),
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
        ])
      );
    });
  });
});
