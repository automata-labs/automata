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
            runs: 50000,
          }
        },
      },
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 5000,
          }
        },
      },
    ],
  },
  gasReporter: {
    enabled: true,
  },
};
