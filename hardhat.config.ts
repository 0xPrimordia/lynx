import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const OPERATOR_KEY = process.env.OPERATOR_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10
      },
      allowUnlimitedContractSize: true,
      blockGasLimit: 100000000,
      gas: 100000000,
      gasPrice: 1,
      initialBaseFeePerGas: 0,
      hardfork: "london"
    },
    hederaTestnet: {
      url: "https://testnet.hashio.io/api",
      accounts: OPERATOR_KEY ? [`0x${OPERATOR_KEY}`] : [],
      chainId: 296,
      gasPrice: 530000000000,
      gas: 400000,
      allowUnlimitedContractSize: true
    }
  },
  paths: {
    sources: "./app/contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
    alwaysGenerateOverloads: true,
    discriminateTypes: true
  },
  mocha: {
    timeout: 100000
  }
};

export default config; 