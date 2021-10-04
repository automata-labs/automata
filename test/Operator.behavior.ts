import { expect } from 'chai';
import { ethers } from 'hardhat';

import { evmMiner, expandTo18Decimals, expandWithDecimals } from './shared/utils';

const { BigNumber } = ethers;

export function shouldBehaveLikeJoin() {
  let abi = new ethers.utils.AbiCoder();

  it('should join', async function () {
    await this.join(this.wallet, expandTo18Decimals(10));
    expect(await this.read(this.token.address, this.wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
  });
  it('should join multiple times', async function () {
    await this.join(this.wallet, expandTo18Decimals(500));
    await this.join(this.wallet, expandTo18Decimals(10));
    expect(await this.read(this.token.address, this.wallet.address)).to.eql([expandTo18Decimals(510), expandTo18Decimals(510)]);
  });
  it('should join dust', async function () {
    await this.join(this.wallet, 1);
    expect(await this.read(this.token.address, this.wallet.address)).to.eql([BigNumber.from(1), BigNumber.from(1)]);
  });
  it('should join line', async function () {
    await this.join(this.wallet, expandTo18Decimals(1023));
    await expect(this.join(this.wallet, expandTo18Decimals(1023))).to.be.reverted.revertedWith('OVF');
  });
  it('should join with different accounts', async function () {
    await this.join(this.wallet, expandTo18Decimals(10));
    await this.token.transfer(this.other1.address, expandTo18Decimals(20));
    await this.join(this.other1, expandTo18Decimals(20));

    // `wallet`
    expect((await this.read(this.token.address, this.wallet.address)).x).to.equal(expandTo18Decimals(10));
    expect((await this.read(this.token.address, this.wallet.address)).y).to.equal(expandTo18Decimals(10));

    // `other1`
    expect((await this.read(this.token.address, this.other1.address)).x).to.equal(expandTo18Decimals(20));
    expect((await this.read(this.token.address, this.other1.address)).y).to.equal(expandTo18Decimals(20));
  });
  it('should join to another accounts', async function () {
    await this.join(this.wallet, expandTo18Decimals(10), this.other1.address, this.other2.address);
    expect(await this.read(this.token.address, this.other1.address)).to.eql([expandTo18Decimals(10), BigNumber.from(0)]);
    expect(await this.read(this.token.address, this.other2.address)).to.eql([BigNumber.from(0), expandTo18Decimals(10)]);
  });
  it('should join to a slot with non-symmetric values', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.operator.transfer(this.other1.address, expandTo18Decimals(25), expandTo18Decimals(75));
    expect(await this.read(this.token.address, this.wallet.address)).to.eql([expandTo18Decimals(75), expandTo18Decimals(25)]);
    expect(await this.read(this.token.address, this.other1.address)).to.eql([expandTo18Decimals(25), expandTo18Decimals(75)]);

    await this.join(this.wallet, expandTo18Decimals(100));
    expect(await this.read(this.token.address, this.wallet.address)).to.eql([expandTo18Decimals(175), expandTo18Decimals(125)]);
  });
  it('should join when governor not active', async function () {
    await this.join(this.wallet, expandTo18Decimals(10));
    expect(await this.read(this.token.address, this.wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
  });
  it('should join when governor active and observe is false', async function () {
    await this.operator.set(this.operator.interface.getSighash('observe'), abi.encode(['bool'], [false]));
    await this.propose(this.wallet, this.governor);
    await this.join(this.wallet, expandTo18Decimals(10));
    expect(await this.read(this.token.address, this.wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
  });
  it('should revert when zero tokens', async function () {
    await expect(this.operator.join(this.wallet.address, this.wallet.address)).to.be.revertedWith('0');
  });
  it('should revert when overflowing limit', async function () {
    await this.operator.set(this.operator.interface.getSighash('limit'), abi.encode(['uint256'], [expandTo18Decimals(100)]));
    await this.join(this.wallet, expandTo18Decimals(100));
    await expect(this.join(this.wallet, 1)).to.be.revertedWith('LIM');
  });
  it('should revert when governor is active', async function () {
    await this.propose(this.wallet, this.governor);

    await this.token.transfer(this.sequencer.address, expandTo18Decimals(10));
    await expect(this.operator.join(this.wallet.address, this.wallet.address)).to.be.revertedWith('OBS');
    await evmMiner(this.provider, (await this.governor.votingPeriod()).toNumber());
    await this.operator.join(this.wallet.address, this.wallet.address);
    expect(await this.read(this.token.address, this.wallet.address)).to.eql([expandTo18Decimals(10), expandTo18Decimals(10)]);
  });
  it('should revert when overflowing sequencer space', async function () {
    await this.join(this.wallet, expandTo18Decimals(1023));
    await expect(this.join(this.wallet, 1)).to.be.revertedWith('OVF');
  });
  it('should emit an event', async function () {
    await this.token.transfer(this.sequencer.address, expandTo18Decimals(1));
    await expect(this.operator.join(this.wallet.address, this.wallet.address))
      .to.emit(this.operator, 'Joined')
      .withArgs(this.wallet.address, this.wallet.address, this.wallet.address, expandTo18Decimals(1));
  });
}

export function shouldBehaveLikeExit() {
  it('should exit', async function () {
    await this.join(this.wallet, expandTo18Decimals(500));

    const balanceBefore = await this.token.balanceOf(this.wallet.address);
    await this.exit(this.wallet, expandTo18Decimals(10));
    const balanceAfter = await this.token.balanceOf(this.wallet.address);
    expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));
  });
  it('should exit multiple times', async function () {
    await this.join(this.wallet, expandTo18Decimals(500));

    const balanceBefore = await this.token.balanceOf(this.wallet.address);
    await this.exit(this.wallet, expandTo18Decimals(10));
    await this.exit(this.wallet, expandTo18Decimals(20));
    const balanceAfter = await this.token.balanceOf(this.wallet.address);
    expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(30)));
    expect((await this.read(this.token.address, this.wallet.address)).x).to.equal(expandTo18Decimals(470));
  });
  it('should exit with different accounts', async function () {
    let balanceBefore;
    let balanceAfter;

    await this.join(this.wallet, expandTo18Decimals(100));
    await this.token.transfer(this.other1.address, expandTo18Decimals(100));
    await this.join(this.other1, expandTo18Decimals(100));

    balanceBefore = await this.token.balanceOf(this.wallet.address);
    await this.exit(this.wallet, expandTo18Decimals(10));
    balanceAfter = await this.token.balanceOf(this.wallet.address);
    expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));

    balanceBefore = await this.token.balanceOf(this.other1.address);
    await this.exit(this.other1, expandTo18Decimals(10));
    balanceAfter = await this.token.balanceOf(this.other1.address);
    expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));
  });
  it('should exit to another account', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));

    const balanceBefore = await this.token.balanceOf(this.other1.address);
    await this.exit(this.wallet, expandTo18Decimals(10), this.other1.address);
    const balanceAfter = await this.token.balanceOf(this.other1.address);
    expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(10)));
  });
  it('should exit dust', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));

    const balanceBefore = await this.token.balanceOf(this.wallet.address);
    await this.exit(this.wallet, 1);
    const balanceAfter = await this.token.balanceOf(this.wallet.address);
    expect(balanceAfter).to.equal(balanceBefore.add(1));
  });
  it('should exit line', async function () {
    await this.join(this.wallet, expandTo18Decimals(1023));

    const balanceBefore = await this.token.balanceOf(this.wallet.address);
    await this.exit(this.wallet, expandTo18Decimals(1023));
    const balanceAfter = await this.token.balanceOf(this.wallet.address);
    expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(1023)));
  });
  it('should exit on non-symmetric slot', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.operator.transfer(this.operator.address, expandTo18Decimals(75), expandTo18Decimals(50));

    const balanceBefore = await this.token.balanceOf(this.wallet.address);
    await this.operator.exit(this.wallet.address);
    const balanceAfter = await this.token.balanceOf(this.wallet.address);
    expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(50)));
  });
  it('should exit when governor is active', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.propose(this.wallet, this.governor);

    const balanceBefore = await this.token.balanceOf(this.wallet.address);
    await this.exit(this.wallet, expandTo18Decimals(100));
    const balanceAfter = await this.token.balanceOf(this.wallet.address);
    expect(balanceAfter).to.equal(balanceBefore.add(expandTo18Decimals(100)));
  });
  it('should revert when exiting zero tokens', async function () {
    await expect(this.operator.exit(this.wallet.address)).to.be.revertedWith('0');
  });
  it('should emit an event', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.operator.transfer(this.operator.address, expandTo18Decimals(100), expandTo18Decimals(100));
    await expect(this.operator.exit(this.wallet.address))
      .to.emit(this.operator, 'Exited')
      .withArgs(this.wallet.address, this.wallet.address, expandTo18Decimals(100));
  });
}

export function shouldBehaveLikeUse() {
  it('should use', async function () {
    await this.join(this.wallet, expandTo18Decimals(100), this.accumulator.address, this.wallet.address);
    await this.accumulator.stake(this.token.address, this.wallet.address);
    await this.propose(this.wallet, this.governor);

    // vote `100` for
    await this.operator.transfer(this.accumulator.address, 0, expandTo18Decimals(75));
    await this.operator.use(this.pid, 1);

    // vote `50` against
    await this.operator.transfer(this.accumulator.address, 0, expandTo18Decimals(25));
    await this.operator.use(this.pid, 0);

    expect((await this.operator.votes(this.pid)).x).to.equal(expandTo18Decimals(75));
    expect((await this.operator.votes(this.pid)).y).to.equal(expandTo18Decimals(25));
  });
  it('should revert when pid is invalid', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.stake(this.wallet, expandTo18Decimals(100));
    await this.propose(this.wallet, this.governor);

    await this.operator.transfer(this.accumulator.address, 0, expandTo18Decimals(100));
    // either `GovernorAlpha::state: invalid proposal id` or `GovernorBravo::state: invalid proposal id`
    await expect(this.operator.use(333, 1)).to.be.reverted;
  });
  it('should revert when `support` is invalid', async function () {
    await this.join(this.wallet, expandTo18Decimals(100), this.accumulator.address, this.wallet.address);
    await this.accumulator.stake(this.token.address, this.wallet.address);
    await this.propose(this.wallet, this.governor);
    await this.operator.transfer(this.accumulator.address, 0, expandTo18Decimals(75));

    for (let i = 2; i <= 8; i++) {
      await expect(this.operator.use(this.pid, i)).to.be.revertedWith('8');
    }
  });
  it.skip('should revert when `use` has not started', async function () {
    await this.join(this.wallet, expandTo18Decimals(100), this.accumulator.address, this.wallet.address);
    await this.accumulator.stake(this.token.address, this.wallet.address);
    await this.operator.transfer(this.accumulator.address, 0, expandTo18Decimals(75));
    await this.propose(this.wallet, this.governor);
    await expect(this.operator.use(this.pid, 0)).to.be.revertedWith('BEG');
    await expect(this.operator.use(this.pid, 1)).to.be.revertedWith('BEG');
  });
  it('should revert when `use` has ended', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.stake(this.wallet, expandTo18Decimals(100));
    await this.propose(this.wallet, this.governor);
    await this.timetravel(this.provider, this.pid, 'start');

    await this.operator.transfer(this.accumulator.address, 0, expandTo18Decimals(100));
    await expect(this.operator.use(this.pid, 1)).to.be.revertedWith('END');
  });
  it('should revert when proposal has ended', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.stake(this.wallet, expandTo18Decimals(100));
    await this.propose(this.wallet, this.governor);
    await this.timetravel(this.provider, this.pid, 'end');

    await this.operator.transfer(this.accumulator.address, 0, expandTo18Decimals(100));
    await expect(this.operator.use(this.pid, 1)).to.be.revertedWith('OBS');
  });
  it('should revert when using zero', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.stake(this.wallet, expandTo18Decimals(100));
    await this.propose(this.wallet, this.governor);

    await expect(this.operator.use(this.pid, 1)).to.be.revertedWith('0');
  });
  it('should revert when nothing staked', async function () {
    await expect(this.operator.use(this.pid, 1)).to.be.reverted;
  });
  it('should revert when proposal is not created', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.stake(this.wallet, expandTo18Decimals(100));
    await expect(this.operator.use(this.pid, 1)).to.be.revertedWith('E');
  });
  it('should emit an event', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.stake(this.wallet, expandTo18Decimals(100));
    await this.propose(this.wallet, this.governor);

    await this.operator.transfer(this.accumulator.address, 0, expandTo18Decimals(100));
    await expect(this.operator.use(this.pid, 1)).to.emit(this.operator, 'Used').withArgs(this.wallet.address, this.pid, 1);
  });
}

export function shouldBehaveLikeLinearRoute() {
  it('(0.5, 0) => (0.5, 0) | 0.5', async function () {
    await this.join(this.wallet, expandWithDecimals(5, 17));
    await this.stake(this.wallet, expandWithDecimals(5, 17));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandWithDecimals(5, 17), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 0)).to.be.revertedWith('F');
  });
  it('(0.9, 0) => (0.9, 0) | 0.9', async function () {
    await this.join(this.wallet, expandWithDecimals(9, 17));
    await this.stake(this.wallet, expandWithDecimals(9, 17));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandWithDecimals(9, 17), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 0)).to.be.revertedWith('F');
  });
  it('(1.1, 0) => (1.1, 0) | 1.1', async function () {
    await this.join(this.wallet, expandWithDecimals(11, 17));
    await this.stake(this.wallet, expandWithDecimals(11, 17));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandWithDecimals(11, 17), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 0);
  });
  it('(0, 0) => (0, 0) | 0', async function () {
    await this.propose(this.wallet, this.governor);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 0)).to.be.revertedWith('F');
  });
  it('(1, 0) => (1, 0) | 1', async function () {
    await this.join(this.wallet, expandTo18Decimals(1));
    await this.stake(this.wallet, expandTo18Decimals(1));
    await this.propose(this.wallet, this.governor);
    await this.use(this.wallet, expandTo18Decimals(1), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 0);
  });
  it('(2, 0) => (2, 0) | 2', async function () {
    await this.join(this.wallet, expandTo18Decimals(2));
    await this.stake(this.wallet, expandTo18Decimals(2));
    await this.propose(this.wallet, this.governor);
    await this.use(this.wallet, expandTo18Decimals(2), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 1); // 1
    await this.operator.route(this.pid, 0); // 1
  });
  it('(3, 0) => (3, 0) | 3', async function () {
    await this.join(this.wallet, expandTo18Decimals(3));
    await this.stake(this.wallet, expandTo18Decimals(3));
    await this.propose(this.wallet, this.governor);
    await this.use(this.wallet, expandTo18Decimals(3), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 1);
    await this.operator.route(this.pid, 0);
  });
  it('(4, 0) => (4, 0) | 4', async function () {
    await this.join(this.wallet, expandTo18Decimals(4));
    await this.stake(this.wallet, expandTo18Decimals(4));
    await this.propose(this.wallet, this.governor);
    await this.use(this.wallet, expandTo18Decimals(4), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await this.operator.route(this.pid, 2); // 1
    await this.operator.route(this.pid, 1); // 2
    await this.operator.route(this.pid, 0); // 1
  });
  it('(5, 0) => (5, 0) | 5', async function () {
    await this.join(this.wallet, expandTo18Decimals(5));
    await this.stake(this.wallet, expandTo18Decimals(5));
    await this.propose(this.wallet, this.governor);
    await this.use(this.wallet, expandTo18Decimals(5), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await this.operator.route(this.pid, 2); // 2
    await this.operator.route(this.pid, 1); // 2
    await this.operator.route(this.pid, 0); // 1
  });
  it('(6, 0) => (6, 0) | 6', async function () {
    await this.join(this.wallet, expandTo18Decimals(6));
    await this.stake(this.wallet, expandTo18Decimals(6));
    await this.propose(this.wallet, this.governor);
    await this.use(this.wallet, expandTo18Decimals(6), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await this.operator.route(this.pid, 2); // 3
    await this.operator.route(this.pid, 1); // 2
    await this.operator.route(this.pid, 0); // 1
  });
  it('(7, 0) => (7, 0) | 7', async function () {
    await this.join(this.wallet, expandTo18Decimals(7));
    await this.stake(this.wallet, expandTo18Decimals(7));
    await this.propose(this.wallet, this.governor);
    await this.use(this.wallet, expandTo18Decimals(7), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await this.operator.route(this.pid, 2); // 4
    await this.operator.route(this.pid, 1); // 2
    await this.operator.route(this.pid, 0); // 1
  });
  it('(8, 0) => (7, 0) | 7', async function () {
    await this.join(this.wallet, expandTo18Decimals(7));
    await this.stake(this.wallet, expandTo18Decimals(7));
    await this.propose(this.wallet, this.governor);
    await this.use(this.wallet, expandTo18Decimals(7), this.pid, 1);
    await this.accumulator.collect(this.token.address, this.wallet.address, expandTo18Decimals(10));
    await this.use(this.wallet, expandTo18Decimals(1), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await this.operator.route(this.pid, 2); // 4
    await this.operator.route(this.pid, 1); // 2
    await this.operator.route(this.pid, 0); // 1

    expect((await this.governor.proposals(this.pid)).forVotes).to.equal(expandTo18Decimals(7).add(3));
    expect((await this.governor.proposals(this.pid)).againstVotes).to.equal(0);
  });
  it('(0, 0) => (0, 0) | 7', async function () {
    await this.join(this.wallet, expandTo18Decimals(7));
    await this.stake(this.wallet, expandTo18Decimals(7));
    await this.propose(this.wallet, this.governor);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 0)).to.be.revertedWith('F');
  });
  it('(1, 0) => (1, 0) | 7', async function () {
    await this.join(this.wallet, expandTo18Decimals(7));
    await this.stake(this.wallet, expandTo18Decimals(7));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(1), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 0);
  });
  it('(2, 0) => (2, 0) | 7', async function () {
    await this.join(this.wallet, expandTo18Decimals(7));
    await this.stake(this.wallet, expandTo18Decimals(7));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(2), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 1);
    await expect(this.operator.route(this.pid, 0)).to.be.revertedWith('F');
  });
  it('(3, 0) => (3, 0) | 7', async function () {
    await this.join(this.wallet, expandTo18Decimals(7));
    await this.stake(this.wallet, expandTo18Decimals(7));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(3), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 1);
    await this.operator.route(this.pid, 0);
  });
  it('(4, 0) => (4, 0) | 7', async function () {
    await this.join(this.wallet, expandTo18Decimals(7));
    await this.stake(this.wallet, expandTo18Decimals(7));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(4), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await this.operator.route(this.pid, 2);
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 0)).to.be.revertedWith('F');
  });
  it('(7, 7) => (0, 0) | 7', async function () {
    await this.join(this.wallet, expandTo18Decimals(7));
    await this.stake(this.wallet, expandTo18Decimals(7));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(7), this.pid, 1);
    await this.accumulator.collect(this.token.address, this.wallet.address, expandTo18Decimals(10));
    await this.use(this.wallet, expandTo18Decimals(7), this.pid, 0);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 0)).to.be.revertedWith('F');
  });
  it('(7, 4) => (3, 0) | 7', async function () {
    await this.join(this.wallet, expandTo18Decimals(7));
    await this.stake(this.wallet, expandTo18Decimals(7));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(7), this.pid, 1);
    await this.accumulator.collect(this.token.address, this.wallet.address, expandTo18Decimals(10));
    await this.use(this.wallet, expandTo18Decimals(4), this.pid, 0);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 1);
    await this.operator.route(this.pid, 0);
  });
  it('(0, 1) => (0, 1) | 7', async function () {
    await this.join(this.wallet, expandTo18Decimals(7));
    await this.stake(this.wallet, expandTo18Decimals(7));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(1), this.pid, 0);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 0);
  });

  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const max = 7;

      it(`(${i}, ${j}) => (${Math.max(i - j, 0)}, ${Math.max(j - i, 0)}) | ${max}`, async function () {
        await this.join(this.wallet, expandTo18Decimals(max));
        await this.stake(this.wallet, expandTo18Decimals(max));
        await this.propose(this.wallet, this.governor);

        if (i > 0) await this.use(this.wallet, expandTo18Decimals(i), this.pid, 1);
        if (i > 0) await this.collect(this.wallet); // collect because voting can overflow
        if (j > 0) await this.use(this.wallet, expandTo18Decimals(j), this.pid, 0);

        await this.timetravel(this.provider, this.pid, 'start');

        // dust is a counter for the initialization dust
        let dust = 0;

        // check if routes can be called
        if ((Math.abs(i - j) & 4) == 4) {
          await this.operator.route(this.pid, 2);
          dust++;
        } else {
          await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
        }

        if ((Math.abs(i - j) & 2) == 2) {
          await this.operator.route(this.pid, 1);
          dust++;
        } else {
          await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
        }

        if ((Math.abs(i - j) & 1) == 1) {
          await this.operator.route(this.pid, 0);
          dust++;
        } else {
          await expect(this.operator.route(this.pid, 0)).to.be.revertedWith('F');
        }

        // check vote results
        if (i - j > 0) {
          expect((await this.governor.proposals(this.pid)).forVotes)
            .to.equal(expandTo18Decimals(Math.max(i - j, 0)).add(dust));
        } else {
          expect((await this.governor.proposals(this.pid)).forVotes).to.equal(0);
        }

        if (j - i > 0) {
          expect((await this.governor.proposals(this.pid)).againstVotes)
            .to.equal(expandTo18Decimals(Math.max(j - i, 0)).add(dust));
        } else {
          expect((await this.governor.proposals(this.pid)).againstVotes).to.equal(0);
        }
      });
    }
  }
}

export function shouldBehaveLikeMiscRoute() {
  it('(100, 0) => (100, 0) | 100', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.stake(this.wallet, expandTo18Decimals(100));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(100), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 10)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 9)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 8)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 7)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 6);
    await this.operator.route(this.pid, 5);
    await this.operator.route(this.pid, 4);
    await this.operator.route(this.pid, 3);
    await this.operator.route(this.pid, 2);
    await this.operator.route(this.pid, 1);
    await this.operator.route(this.pid, 0);
  });
  it('(75, 0) => (75, 0) | 75', async function () {
    // route with 75 - filled 63 and excess 12 => 75.
    await this.join(this.wallet, expandTo18Decimals(75));
    await this.stake(this.wallet, expandTo18Decimals(75));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(75), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 10)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 9)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 8)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 7)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 6);
    await this.operator.route(this.pid, 5);
    await this.operator.route(this.pid, 4);
    await this.operator.route(this.pid, 3);
    await this.operator.route(this.pid, 2);
    await this.operator.route(this.pid, 1);
    await this.operator.route(this.pid, 0);
  });
  it('(38, 0) => (38, 0) | 38', async function () {
    await this.join(this.wallet, expandTo18Decimals(38));
    await this.stake(this.wallet, expandTo18Decimals(38));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(38), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 10)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 9)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 8)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 7)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 6)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 5);
    await this.operator.route(this.pid, 4);
    await this.operator.route(this.pid, 3);
    await this.operator.route(this.pid, 2);
    await this.operator.route(this.pid, 1);
    await this.operator.route(this.pid, 0);
  });
  it('(75, 0) => (75, 0) | 100', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.stake(this.wallet, expandTo18Decimals(100));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(75), this.pid, 1);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 10)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 9)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 8)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 7)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 6);
    await this.operator.route(this.pid, 5);
    await expect(this.operator.route(this.pid, 4)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 3)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 2);
    await this.operator.route(this.pid, 1);
    await expect(this.operator.route(this.pid, 0)).to.be.revertedWith('F');
  });
  it('(50, 25) => (50, 25) | 100', async function () {
    await this.join(this.wallet, expandTo18Decimals(100));
    await this.stake(this.wallet, expandTo18Decimals(100));
    await this.propose(this.wallet, this.governor);

    await this.use(this.wallet, expandTo18Decimals(50), this.pid, 1);
    await this.use(this.wallet, expandTo18Decimals(25), this.pid, 0);
    await this.timetravel(this.provider, this.pid, 'start');

    await expect(this.operator.route(this.pid, 10)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 9)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 8)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 7)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 6)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 5)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 4);
    await this.operator.route(this.pid, 3);
    await expect(this.operator.route(this.pid, 2)).to.be.revertedWith('F');
    await expect(this.operator.route(this.pid, 1)).to.be.revertedWith('F');
    await this.operator.route(this.pid, 0);
  });
}
