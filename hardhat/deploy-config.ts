import { HardhatUserConfig } from "hardhat/types";

export interface DeploymentConfig {
  networks: {
    [network: string]: NetworkConfig;
  };
  contracts: {
    [contract: string]: ContractConfig;
  };
}

export interface NetworkConfig {
  gasPrice?: number;
  gasLimit?: number;
  confirmations?: number;
  timeout?: number;
  accounts?: {
    mnemonic?: string;
    path?: string;
    initialIndex?: number;
    count?: number;
  };
}

export interface ContractConfig {
  dependencies?: string[];
  constructorArgs?: any[];
  libraries?: {
    [library: string]: string;
  };
  upgradeable?: boolean;
  proxy?: {
    kind: "uups" | "transparent" | "beacon";
    implementation?: string;
  };
}

export interface TokenConfig {
  name: string;
  symbol: string;
  memo: string;
}

const config: DeploymentConfig = {
  networks: {
    hederaTestnet: {
      gasPrice: 100000000, // 0.1 gwei
      gasLimit: 500000,
      confirmations: 2,
      timeout: 60000,
    },
    hederaMainnet: {
      gasPrice: 1000000000, // 1 gwei
      gasLimit: 500000,
      confirmations: 5,
      timeout: 120000,
    }
  },
  contracts: {
    IndexVault: {
      dependencies: [],
      constructorArgs: ["0x0000000000000000000000000000000000000000"], // Placeholder controller
    },
    IndexTokenController: {
      dependencies: ["IndexVault"],
      constructorArgs: [
        "{{IndexVault}}", // Will be replaced with actual address
        "0x0000000000000000000000000000000000000167", // HTS precompile
        {
          name: "Lynx Index Token",
          symbol: "LYNX",
          memo: "Lynx Protocol Index Token"
        } as TokenConfig
      ],
    },
    MockHederaTokenService: {
      dependencies: [],
      constructorArgs: [],
    }
  }
};

export default config; 