import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import * as _ from 'lodash';

import { ERC20CompLike, GovernorBravoMock, Sequencer, Shard } from '../typechain';
import { erc20CompLikeFixture, governorBravoFixture } from './shared/fixtures';
import { deploy, expandTo18Decimals, MAX_UINT256 } from './shared/utils';

const { createFixtureLoader } = waffle;
const { BigNumber, provider } = ethers;

describe('Sequencer', async () => {
  let abi = new ethers.utils.AbiCoder();
  let loadFixture;  
  let wallet;
  let other1;
  let other2;

  let token: ERC20CompLike;
  let governor: GovernorBravoMock;

  let sequencer: Sequencer;

  const fixture = async () => {
    token = await erc20CompLikeFixture(provider, wallet);
    ;({ governor } = await governorBravoFixture(provider, token, wallet));

    sequencer = (await deploy('Sequencer', token.address)) as Sequencer;
  };
  
  const cloneFixture = async () => {
    await fixture();
    await token.approve(sequencer.address, MAX_UINT256);
  };

  const clonesFixture = async () => {
    await fixture();
    await token.approve(sequencer.address, MAX_UINT256);
  };

  const depositFixture = async () => {
    await fixture();
    await token.approve(sequencer.address, MAX_UINT256);
  };

  const withdrawFixture = async () => {
    await fixture();
    await token.approve(sequencer.address, MAX_UINT256);
  };

  before('fixture loader', async () => {
    ;([wallet, other1, other2] = await ethers.getSigners());
    loadFixture = createFixtureLoader([wallet]);
  });

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
      await token.connect(other1).approve(sequencer.address, MAX_UINT256);
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
      await expect(sequencer.clone()).to.emit(sequencer, 'Cloned').withArgs(0, address);
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
      await expect(sequencer.clones(MAX_UINT256)).to.be.reverted;
    });
    it('should revert when token is not approved', async () => {
      await sequencer.clones(10);
      await token.approve(sequencer.address, 0);
      await expect(sequencer.clones(1))
        .to.be.revertedWith('TransferHelper::transferFrom: transferFrom failed');
    });
    it('should revert when token is approved but transfer fails', async () => {
      await token.connect(other1).approve(sequencer.address, MAX_UINT256);
      await expect(sequencer.connect(other1).clones(1))
        .to.be.revertedWith('TransferHelper::transferFrom: transferFrom failed');
    });
  });

  describe('#deposit', async () => {
    beforeEach(async () => {
      await loadFixture(depositFixture);
    });

    it('should deposit non-zero on non-zero shards', async () => {
      await sequencer.clones(10);
      await token.transfer(sequencer.address, expandTo18Decimals(100));
      await sequencer.deposit();
      expect(await sequencer.liquidity()).to.equal(expandTo18Decimals(100));
    });
    it('should deposit 127 units', async () => {
      await sequencer.clones(10);
      await token.transfer(sequencer.address, expandTo18Decimals(127));
      await sequencer.deposit();

      const liquidity = await sequencer.liquidity();
      const decimals = await sequencer.decimals();
      expect(liquidity).to.equal(expandTo18Decimals(127));
      expect(decimals).to.equal(18);
    });
    it('should deposit 127 units - 1', async () => {
      await sequencer.clones(10);
      await token.transfer(sequencer.address, expandTo18Decimals(127).sub(1));
      await sequencer.deposit();
      
      const liquidity = await sequencer.liquidity();
      const decimals = await sequencer.decimals();
      expect(liquidity).to.equal(expandTo18Decimals(127).sub(1));
      expect(decimals).to.equal(18);
    });
    it('should deposit 255 units', async () => {
      await sequencer.clones(10);
      await token.transfer(sequencer.address, expandTo18Decimals(255));
      await sequencer.deposit();

      const liquidity = await sequencer.liquidity();
      const decimals = await sequencer.decimals();
      expect(liquidity).to.equal(expandTo18Decimals(255));
      expect(decimals).to.equal(18);
    });
    it('should deposit 10^9 - 1 units', async () => {
      const amount = expandTo18Decimals(BigNumber.from(10).pow(9).sub(1).toString());
      await sequencer.clones(30);
      await token.transfer(sequencer.address, amount);
      await sequencer.deposit();

      const liquidity = await sequencer.liquidity();
      const decimals = await sequencer.decimals();
      expect(liquidity).to.equal(amount);
      expect(decimals).to.equal(18);
    });
    it('should revert when zero on zero shards', async () => {
      await expect(sequencer.deposit()).to.be.revertedWith('0');
    });
    it('should revert when zero on non-zero shards', async () => {
      await sequencer.clones(10);
      await expect(sequencer.deposit()).to.be.revertedWith('0');
    });
    it('should revert when sequencing non-zero on zero shards', async () => {
      await token.transfer(sequencer.address, 1);
      await expect(sequencer.deposit()).to.be.revertedWith('OVF');
    });
    it('should revert when sequencing overflows', async () => {
      await sequencer.clones(5);
      await token.transfer(sequencer.address, expandTo18Decimals(5));
      await sequencer.deposit();
      await token.transfer(sequencer.address, expandTo18Decimals(30));
      await expect(sequencer.deposit()).to.be.revertedWith('OVF');
    });
    it('should revert when no access', async () => {
      await expect(sequencer.connect(other1).deposit()).to.be.revertedWith('Access denied');
      await expect(sequencer.connect(other2).deposit()).to.be.revertedWith('Access denied');
    });
    it('should emit an event', async () => {
      await sequencer.clones(5);
      await token.transfer(sequencer.address, expandTo18Decimals(10));
      await expect(sequencer.deposit()).to.emit(sequencer, 'Sequenced').withArgs(expandTo18Decimals(10));
      await token.transfer(sequencer.address, expandTo18Decimals(5));
      await expect(sequencer.deposit()).to.emit(sequencer, 'Sequenced').withArgs(expandTo18Decimals(15));
    });
  });

  describe('#withdraw', async () => {
    beforeEach(async () => {
      await loadFixture(withdrawFixture);
    });

    it('should withdraw', async () => {
      await sequencer.clones(5);
      await token.transfer(sequencer.address, expandTo18Decimals(5));
      await sequencer.deposit();

      await sequencer.withdraw(other1.address, expandTo18Decimals(3));
      expect(await sequencer.liquidity()).to.equal(expandTo18Decimals(2));
      expect(await token.balanceOf(other1.address)).to.equal(expandTo18Decimals(3));
    });
    it('should withdraw with excess of 1', async () => {
      await sequencer.clones(5);
      await token.transfer(sequencer.address, expandTo18Decimals(3).add(1));
      await sequencer.deposit();
      await sequencer.withdraw(other1.address, expandTo18Decimals(3).add(1));
      expect(await sequencer.liquidity()).to.equal(0);
      expect(await token.balanceOf(other1.address)).to.equal(expandTo18Decimals(3).add(1));
    });
    it('should withdraw all from max deposit', async () => {
      await sequencer.clones(10);
      await token.transfer(sequencer.address, expandTo18Decimals(1023));
      await sequencer.deposit();

      await sequencer.withdraw(other1.address, expandTo18Decimals(1023));
      expect(await sequencer.liquidity()).to.equal(0);
      expect(await token.balanceOf(other1.address)).to.equal(expandTo18Decimals(1023));
    });
    it('should revert when withdrawing zero on zero liquidity', async () => {
      await expect(sequencer.withdraw(wallet.address, 0)).to.be.revertedWith("0");
    });
    it('should revert when withdrawing zero on non-zero liquidity', async () => {
      await sequencer.clones(5);
      await token.transfer(sequencer.address, expandTo18Decimals(5));
      await sequencer.deposit();
      await expect(sequencer.withdraw(other1.address, 0)).to.be.revertedWith("0");
    });
    it('should revert on withdraw overflows', async () => {
      await sequencer.clones(5);
      await token.transfer(sequencer.address, expandTo18Decimals(5));
      await sequencer.deposit();
      await expect(sequencer.withdraw(other1.address, expandTo18Decimals(5).add(1))).to.be.reverted;
    });
    it('should revert when no access', async () => {
      await expect(sequencer.connect(other1).withdraw(wallet.address, expandTo18Decimals(1))).to.be.revertedWith('Access denied');
      await expect(sequencer.connect(other2).withdraw(wallet.address, expandTo18Decimals(1))).to.be.revertedWith('Access denied');
    });
    it('should emit an event', async () => {
      await sequencer.clones(5);
      await token.transfer(sequencer.address, expandTo18Decimals(5));
      await sequencer.deposit();
      await expect(sequencer.withdraw(other1.address, expandTo18Decimals(3)))
        .to.emit(sequencer, 'Withdrawn')
        .withArgs(expandTo18Decimals(2));
    });
  });
});
