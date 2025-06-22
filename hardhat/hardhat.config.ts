import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "./tasks/token";
import "./tasks/accounts";
import "./tasks/create-token";
import "./tasks/create-token-debug";
import "./tasks/token-fund";
import "./tasks/deep-debug";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hederaTestnet: {
      url: process.env.HEDERA_TESTNET_ENDPOINT || "https://testnet.hashio.io/api",
      chainId: 296,
      gasPrice: 700000000000, // 700 gwei (above minimum of 680)
      loggingEnabled: true,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      accounts: [process.env.OPERATOR_KEY!]
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 600,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY // Optional for price data
  }
};

export default config;