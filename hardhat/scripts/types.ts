export interface TokenConfig {
  name: string;
  symbol: string;
  memo: string;
}

export interface DeploymentInfo {
  network: string;
  timestamp: string;
  contracts: {
    [key: string]: {
      address: string;
      deployer: string;
      constructorArgs: any[];
    };
  };
} 