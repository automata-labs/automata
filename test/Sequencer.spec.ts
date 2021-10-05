import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import * as _ from 'lodash';

import { erc20CompLikeFixture } from './shared/fixtures';
import { deploy, evmBlockNumber, evmMine, expandTo18Decimals } from './shared/utils';
import { CursorMock, ERC20CompLike, Sequencer, Shard } from '../typechain';
import { BigNumberish } from '@ethersproject/bignumber';

const { BigNumber, constants, provider } = ethers;
const { MaxUint256 } = constants;
const { loadFixture } = waffle;

describe('Sequencer', async () => {
  let wallet;
  let other1;
  let other2;
  let holder;

  let token: ERC20CompLike;
  let cursor: CursorMock;
  let sequencer: Sequencer;

  const fixture = async () => {
    ;([wallet, other1, other2, holder] = await ethers.getSigners());
  
    token = await erc20CompLikeFixture(provider, wallet);
    cursor = (await deploy('CursorMock')) as CursorMock;
    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
  };
  
  const clones = async (amount) => {
    await sequencer.clones(amount);
  };

  const deposit = async (amount) => {
    await token.transfer(sequencer.address, amount);
    return await sequencer.deposit();
  };

  const withdraw = async (amount, dst) => {
    return await sequencer.withdraw(dst, amount);
  };

  const check = async (_liquidity: BigNumberish) => {
    // mine one block to register votes on `getPriorVotes`
    await evmMine(provider);
    // check sequencer's virtual liquidity value
    const liquidity = BigNumber.from(_liquidity);
    expect(await sequencer.liquidity()).to.equal(liquidity);

    // check real token amounts in shards
    let gross = BigNumber.from(0);
    for (let i = 0; i < (await sequencer.cardinality()).toNumber(); i++) {
      const balance = await token.balanceOf(await sequencer.shards(i));
      const crsr = (await cursor.getCursor(liquidity, 18)).toNumber();

      if (crsr > i) {
        const expected = expandTo18Decimals(2 ** i).add(1);
        expect(balance).to.equal(expected);
        expect(await token.getCurrentVotes(await sequencer.shards(i))).to.equal(expected);
        expect(await token.getPriorVotes(await sequencer.shards(i), (await evmBlockNumber(provider)) - 1)).to.equal(expected);
      } else if (crsr == i) {
        const excess = liquidity.sub(expandTo18Decimals(2 ** i).sub(expandTo18Decimals(1))).add(1);
        expect(balance).to.equal(excess);
        expect(await token.getCurrentVotes(await sequencer.shards(i))).to.equal(excess);
        expect(await token.getPriorVotes(await sequencer.shards(i), (await evmBlockNumber(provider)) - 1)).to.equal(excess);
      } else {
        expect(balance).to.equal(1);
      }

      gross = gross.add(balance).sub(1);
    }
    expect(gross).to.equal(liquidity);

    return true;
  };

  const cloneFixture = async () => {
    await fixture();
    await token.approve(sequencer.address, MaxUint256);
  };

  const clonesFixture = async () => {
    await fixture();
    await token.approve(sequencer.address, MaxUint256);
  };

  const depositFixture = async () => {
    await fixture();
    await token.approve(sequencer.address, MaxUint256);
  };

  const withdrawFixture = async () => {
    await fixture();
    await token.approve(sequencer.address, MaxUint256);
  };

  describe('#clone', async () => {
    beforeEach(async () => {
      await loadFixture(cloneFixture);
    });

    it('should clone', async () => {
      expect(await sequencer.cardinality()).to.equal(0);
      await sequencer.clone();
      expect(await sequencer.cardinality()).to.equal(1);
      await sequencer.clone();
      expect(await sequencer.cardinality()).to.equal(2);
    });
    it('should clone to max cardinality upper bound', async () => {
      const max = (await sequencer.cardinalityMax()).toNumber();
      expect(await sequencer.cardinality()).to.equal(0);
      for (let i = 0; i < max; i++) {
        await sequencer.clone();
      }
      expect(await sequencer.cardinality()).to.equal(max);
    });
    it('should revert when max cardinality is reached', async () => {
      const max = (await sequencer.cardinalityMax()).toNumber();
      for (let i = 0; i < max; i++) {
        await sequencer.clone();
      }
      await expect(sequencer.clone()).to.be.reverted;
    });
    it('should revert when token is not approved', async () => {
      await token.approve(sequencer.address, 0);
      await expect(sequencer.clone()).to.be.revertedWith('TransferHelper::transferFrom: transferFrom failed');
    });
    it('should revert when token is approved but transfer fails', async () => {
      await token.connect(other1).approve(sequencer.address, MaxUint256);
      await expect(sequencer.connect(other1).clone()).to.be.revertedWith('TransferHelper::transferFrom: transferFrom failed');
    });
    it('should revert when external calling `initialize` on shard after cloning', async () => {
      await sequencer.clone();
      const shard0 = (await ethers.getContractAt('Shard', await sequencer.shards(0))) as Shard;
      await expect(shard0.initialize()).to.be.revertedWith('Initializable: contract is already initialized');
    });
    it('should revert when external calling `initialize` on implementation and shard', async () => {
      const implementation = (await ethers.getContractAt('Shard', await sequencer.implementation())) as Shard;
      expect(await implementation.hasRole('0x00000000', sequencer.address)).to.be.true;
      expect(await implementation.hasRole('0x00000000', wallet.address)).to.be.false;
      await expect(implementation.initialize()).to.be.revertedWith('Initializable: contract is already initialized');
      
      await sequencer.clone();
      const shard0 = (await ethers.getContractAt('Shard', await sequencer.shards(0))) as Shard;
      expect(await shard0.hasRole('0x00000000', sequencer.address)).to.be.true;
      expect(await shard0.hasRole('0x00000000', wallet.address)).to.be.false;
      await expect(shard0.initialize()).to.be.revertedWith('Initializable: contract is already initialized');
    });
    it('should emit an event', async () => {
      const address = await sequencer.compute(0);
      await expect(sequencer.clone()).to.emit(sequencer, 'Cloned').withArgs(wallet.address, 0, address);
    });
  });

  describe('#clones', async () => {
    beforeEach(async () => {
      await loadFixture(clonesFixture);
    });

    it('should create zero clones', async () => {
      await sequencer.clones(0);
      expect(await sequencer.cardinality()).to.equal(0);
    });
    it('should create zero clones with approving token', async () => {
      await token.approve(sequencer.address, 0);
      await sequencer.clones(0);
      expect(await sequencer.cardinality()).to.equal(0);
    });
    it('should create non-zero clones', async () => {
      await sequencer.clones(1);
      expect(await sequencer.cardinality()).to.equal(1);
      await sequencer.clones(7);
      expect(await sequencer.cardinality()).to.equal(8);

      let shardAddresses = [];
      for (let i = 0; i < 8; i++) {
        const shardAddress = await sequencer.shards(i);
        expect(shardAddress).to.not.equal(ethers.constants.AddressZero);
        expect(await sequencer.cursors(shardAddress)).to.equal(i);
        shardAddresses.push(shardAddress);
      }

      expect(_.uniq(shardAddresses).length).to.equal(8);
    });
    it('should create max clones', async () => {
      // clone 10 per call to avoid reverting due to gas costs etc.
      for (let i = 0; i < 25; i++) {
        await sequencer.clones(10);
      }
      await sequencer.clones(6);
      expect(await sequencer.cardinality()).to.equal(256);
    });
    it('should revert on cardinality max reached', async () => {
      for (let i = 0; i < 25; i++) {
        await sequencer.clones(10);
      }
      await sequencer.clones(6);
      expect(await sequencer.cardinality()).to.equal(256);
      await expect(sequencer.clones(1)).to.be.revertedWith('MAX');
      await expect(sequencer.clones(MaxUint256)).to.be.reverted;
    });
    it('should revert when token is not approved', async () => {
      await sequencer.clones(10);
      await token.approve(sequencer.address, 0);
      await expect(sequencer.clones(1))
        .to.be.revertedWith('TransferHelper::transferFrom: transferFrom failed');
    });
    it('should revert when token is approved but transfer fails', async () => {
      await token.connect(other1).approve(sequencer.address, MaxUint256);
      await expect(sequencer.connect(other1).clones(1))
        .to.be.revertedWith('TransferHelper::transferFrom: transferFrom failed');
    });
  });

  describe('#deposit', async () => {
    beforeEach(async () => {
      await loadFixture(depositFixture);
    });

    it('(0) + (1e18)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1));
      expect(await check(expandTo18Decimals(1))).to.be.true;
    });
    it('(0) + (1e18 - 1)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1).sub(1));
      expect(await check(expandTo18Decimals(1).sub(1))).to.be.true;
    });
    it('(0) + (1e18 + 1)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1).add(1));
      expect(await check(expandTo18Decimals(1).add(1))).to.be.true;
    });

    // should only cross 1 shard
    it('(1e18 - 1) + (2)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1).sub(1));
      await deposit(expandTo18Decimals(2));

      const amount = expandTo18Decimals(1).sub(1).add(expandTo18Decimals(2));
      expect(await check(amount)).to.be.true;
    });
    // should only cross 1 shard
    it('(1e18 - 1) + (2e18 + 1)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1).sub(1));
      await deposit(expandTo18Decimals(2).add(1));

      const amount = expandTo18Decimals(1).sub(1).add(expandTo18Decimals(2).add(1));
      expect(await check(amount)).to.be.true;
    });
    // should only cross 2 shards
    it('(1e18 - 1) + (2e18 + 2)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1).sub(1));
      await deposit(expandTo18Decimals(2).add(2));

      const amount = expandTo18Decimals(1).sub(1).add(expandTo18Decimals(2).add(2));
      expect(await check(amount)).to.be.true;
    });
    // should only cross 1 shard
    it('(1e18 + 0) + (1)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1));
      await deposit(1);

      const amount = expandTo18Decimals(1).add(1);
      expect(await check(amount)).to.be.true;
    });
    // should only cross 1 shard
    it('(1e18 + 0) + (2e18)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1));
      await deposit(expandTo18Decimals(2));

      const amount = expandTo18Decimals(3);
      expect(await check(amount)).to.be.true;
    });
    // should only cross 2 shards
    it('(1e18 + 0) + (2e18 + 1)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1));
      await deposit(expandTo18Decimals(2).add(1));

      const amount = expandTo18Decimals(3).add(1);
      expect(await check(amount)).to.be.true;
    });

    it('(0) + (127e18)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(127));
      expect(await check(expandTo18Decimals(127))).to.be.true;
    });
    it('(0) + (127e18 - 1)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(127).sub(1));
      expect(await check(expandTo18Decimals(127).sub(1))).to.be.true;
    });
    it('(0) + (127e18 + 1)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(127));
      expect(await check(expandTo18Decimals(127))).to.be.true;
    });
    it('(0) + (255e18)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(255));
      expect(await check(expandTo18Decimals(255))).to.be.true;
    });
    it('(0) + (10^8e18 - 1)', async () => {
      await clones(30);
      const amount = expandTo18Decimals(BigNumber.from(10).pow(8).sub(1).toString());
      await deposit(amount);
      expect(await check(amount)).to.be.true;
    });
    it('(0) + (10^8e18 + 1)', async () => {
      await clones(30);
      const amount = expandTo18Decimals(BigNumber.from(10).pow(8).add(1).toString());
      await deposit(amount);
      expect(await check(amount)).to.be.true;
    });
    it('(0) + (10^8e18)', async () => {
      await clones(30);
      const amount = expandTo18Decimals(BigNumber.from(10).pow(8).toString());
      await deposit(amount);
      expect(await check(amount)).to.be.true;
    });
    it('(x) + (0) reverts', async () => {
      // deposit 0 when no shards exist
      await expect(sequencer.deposit()).to.be.revertedWith('0');
      // create shards, should still revert
      await clones(3);
      await expect(sequencer.deposit()).to.be.revertedWith('0');
      // should revert when shards and deposit exists if deposit amount is 0
      await deposit(expandTo18Decimals(2));
      await expect(sequencer.deposit()).to.be.revertedWith('0');
    });
    it('should revert when zero on non-zero shards', async () => {
      await clones(10);
      await expect(sequencer.deposit()).to.be.revertedWith('0');
    });
    it('should revert when depositing non-zero on zero shards', async () => {
      await expect(deposit(1)).to.be.revertedWith('OVF');
    });
    it('should revert when depositing overflows', async () => {
      await clones(5);
      await deposit(expandTo18Decimals(5));
      await expect(deposit(expandTo18Decimals(30))).to.be.revertedWith('OVF');
    });
    it('should revert when no access', async () => {
      await expect(sequencer.connect(other1).deposit()).to.be.revertedWith('Access denied');
      await expect(sequencer.connect(other2).deposit()).to.be.revertedWith('Access denied');
    });
    it('should emit an event', async () => {
      await clones(5);
      await expect(deposit(expandTo18Decimals(10))).to.emit(sequencer, 'Sequenced').withArgs(wallet.address, expandTo18Decimals(10));;
      await expect(deposit(expandTo18Decimals(5))).to.emit(sequencer, 'Sequenced').withArgs(wallet.address, expandTo18Decimals(15));
    });
  });

  describe('#withdraw', async () => {
    beforeEach(async () => {
      await loadFixture(withdrawFixture);
    });

    it('(1e18 + 0) - (1)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1));
      await withdraw(1, holder.address);
      expect(await check(expandTo18Decimals(1).sub(1))).to.be.true;
      expect(await token.balanceOf(holder.address)).to.equal(1);
    });
    it('(1e18 + 1) - (1)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1).add(1));
      await withdraw(1, holder.address);
      expect(await check(expandTo18Decimals(1))).to.be.true;
      expect(await token.balanceOf(holder.address)).to.equal(1);
    });
    it('(1e18 + 2) - (1)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1).add(2));
      await withdraw(1, holder.address);
      expect(await check(expandTo18Decimals(1).add(1))).to.be.true;
      expect(await token.balanceOf(holder.address)).to.equal(1);
    });
    it('(1e18) - (1e18)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1));
      await withdraw(expandTo18Decimals(1), holder.address);
      expect(await check(0)).to.be.true;
      expect(await token.balanceOf(holder.address)).to.equal(expandTo18Decimals(1));
    });
    it('(5e18) - (3e18)', async () => {
      await clones(5);
      await deposit(expandTo18Decimals(5));
      await withdraw(expandTo18Decimals(3), holder.address);
      expect(await check(expandTo18Decimals(2))).to.be.true;
      expect(await token.balanceOf(holder.address)).to.equal(expandTo18Decimals(3));
    });
    it('(5e18) - (3e18 + 1)', async () => {
      await clones(5);
      await deposit(expandTo18Decimals(5));
      await withdraw(expandTo18Decimals(3).add(1), holder.address);
      expect(await check(expandTo18Decimals(2).sub(1))).to.be.true;
      expect(await token.balanceOf(holder.address)).to.equal(expandTo18Decimals(3).add(1));
    });
    it('(333e18) - (333e18)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(333));
      expect(await check(expandTo18Decimals(333))).to.be.true;
      await withdraw(expandTo18Decimals(333), holder.address);
      expect(await check(0)).to.be.true;
      expect(await token.balanceOf(holder.address)).to.equal(expandTo18Decimals(333));
    });
    it('(1023e18) - (1023e18)', async () => {
      await clones(10);
      await deposit(expandTo18Decimals(1023));
      expect(await check(expandTo18Decimals(1023))).to.be.true;
      await withdraw(expandTo18Decimals(1023), holder.address);
      expect(await check(0)).to.be.true;
      expect(await token.balanceOf(holder.address)).to.equal(expandTo18Decimals(1023));
    });
    it('(0) - (0) reverts', async () => {
      await expect(withdraw(0, holder.address)).to.be.revertedWith("0");
    });
    it('(x) - (0) reverts', async () => {
      await clones(1);
      await deposit(expandTo18Decimals(1));
      await expect(withdraw(0, holder.address)).to.be.revertedWith("0");
    });
    it('(1e18) - (1e18 + 1) underflows', async () => {
      await clones(1);
      await deposit(expandTo18Decimals(1));
      await expect(withdraw(expandTo18Decimals(1).add(1), holder.address)).to.be.reverted;
      // should still fail if more than one shard
      await clones(1);
      await expect(withdraw(expandTo18Decimals(1).add(1), holder.address)).to.be.reverted;
    });
    it('should revert when no access', async () => {
      await expect(sequencer.connect(other1).withdraw(wallet.address, expandTo18Decimals(1))).to.be.revertedWith('Access denied');
      await expect(sequencer.connect(other2).withdraw(wallet.address, expandTo18Decimals(1))).to.be.revertedWith('Access denied');
    });
    it('should emit an event', async () => {
      await clones(5);
      await deposit(expandTo18Decimals(5));
      await expect(withdraw(expandTo18Decimals(3), holder.address))
        .to.emit(sequencer, 'Withdrawn')
        .withArgs(wallet.address, expandTo18Decimals(2));
    });
  });
});
