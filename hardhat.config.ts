require('dotenv').config();

import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'hardhat-contract-sizer';
import 'solidity-coverage';

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000,
          }
        },
      },
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          }
        },
      },
    ],
  },
  overrides: {
    'contracts/Kernel.sol': {
      version: '0.8.9',
      settings: {
        optimizer: {
          enabled: true,
          runs: 999999,
        },
      },
    },
  },
  gasReporter: {
    enabled: true,
  },
};
