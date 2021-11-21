# AS-001 Documentation

The AS-001 protocol is a mechanism that tokenizes DAO token's votes into discrete amounts. By discrete amounts, we mean ERC20 tokens that are one-time usable votes. This differs from the normal DAO tokens that are reusable and have an infinite amount of uses. By depositing DAO tokens into a pool, it becomes possible to ensure votes available at the time of a proposal and allows users to trade votes at any time.

## Files

| Filename | Description |
|---|---|
| Kernel.sol | The storage contract that is non-upgradeable. |
| Accumulator.sol | The position contract. Represents each position as an ERC721. |
| Sequencer.sol | The pool contract that manages all of the deposited DAO tokens. Because of limitations in Governor Alpha and -Bravo, the sequencer needs to be sharded into separate contracts, each with the power of `2`. The most shards are crossed when depositing, the higher the gas cost. When `n` in `2^n` is large enough, the gas cost will trend toward the same gas costs as if shards did not exist. |
| Shard.sol | A pool shard that holds at most 2^n amount of DAO tokens. |
| VToken.sol | A non-native ERC20 token implementation for tokenizing DAO votes. |
| Operator.sol | The operator follows a similar pattern as `dss` with the `join` and `exit` functions. |
| Application.sol | The periphery contract that interfaces with the protocol. Users are expected to only call functions on this contract when using the `ui`. |

## Access Control

The access control for the contract set is using the `AccessControl.sol` library from `@yield-protocol/yield-utils-v2`. One modification has been done that allows `ROOT` roles to call any function in the contract. This simplifies the process when granting access to a contract or an account. A `ROOT` role will be able to grant function specific roles either way, so it's a convenience modification of the library.

## Capacity Control

The `Sequencer.sol` starts out with `0` token capacity when deployed. To increase the capacity, the `clone` fion will need to be called by any account. The `clone` function is permissionless. This is the inherent technical cap on the sequencer, and to put a tweakable cap for e.g. a guarded launch, the `limit` variable can be set in the `Operator.sol` using the `set` function.

## DAO Upgrades

When the underlying DAOs upgrades, AS-001 might need to update its contracts too. By granting Automata Labs Inc. root access to the contracts to start with, the contract set can easily be upgraded without having to re-deploy any critical parts, i.e. the stateful `Kernel.sol` contract.

## Math

AS-001 is using the `FullMath.sol` library from Uniswap V3.
