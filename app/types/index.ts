export interface Token {
  id: string;
  symbol: string;
  name: string;
  icon: string;
}

// HashPack wallet response interface
export interface HashPackWalletResponse {
  id?: string | number;
  transactionId?: string | number;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface SectorData {
  name: string;
  selectedToken: string;
  tokens: string[];
  allocations?: { [key: string]: number };
}

export interface CompositionData {
  sectors: {
    [key: string]: SectorData;
  };
  aiRecommendation?: {
    sectors: {
      [key: string]: SectorData;
    };
    reasoning: string;
  };
}

// Actual DAO Parameters structure
export interface DaoParameters {
  rebalancing: RebalancingParameters;
  treasury: TreasuryParameters;
  fees: FeeParameters;
  governance: GovernanceParameters;
  metadata: ParameterMetadata;
}

// Rebalancing Parameters
export interface RebalancingParameters {
  frequencyHours: number; // 4, 6, 12, 24, 48 hours
  thresholds: {
    normal: number;    // 5, 7, 10, 15 %
    emergency: number; // 10, 15, 20, 25 %
  };
  cooldownPeriods: {
    normal: number;    // 24, 48, 72, 168 hours  
    emergency: number; // 0, 6, 12, 24 hours
  };
}

// Parameter object structure from HCS
export interface ParameterObject<T = unknown> {
  value: T;
  options?: T[];
  lastChanged?: string;
  minQuorum?: number;
  description?: string;
}

// Helper type for parameters that can be either simple values or parameter objects
export type ParameterValue<T> = T | ParameterObject<T>;

// Treasury Parameters with flexible typing
export interface TreasuryParameters {
  weights: TokenWeights;
  maxSlippage: TokenSlippage;
  maxSwapSize: TokenSwapSizes; // in USD
}

export interface TokenWeights {
  HBAR: ParameterValue<number>;      // Core Hedera
  WBTC: ParameterValue<number>;      // Smart Contract Platforms
  SAUCE: ParameterValue<number>;     // DeFi & DEX Tokens
  USDC: ParameterValue<number>;      // Stablecoins
  JAM: ParameterValue<number>;       // Enterprise & Utility Tokens
  HEADSTART: ParameterValue<number>; // GameFi & NFT Infrastructure
}

export interface TokenSlippage {
  HBAR: ParameterValue<number>;      // Core Hedera
  WBTC: ParameterValue<number>;      // Smart Contract Platforms
  SAUCE: ParameterValue<number>;     // DeFi & DEX Tokens
  USDC: ParameterValue<number>;      // Stablecoins
  JAM: ParameterValue<number>;       // Enterprise & Utility Tokens
  HEADSTART: ParameterValue<number>; // GameFi & NFT Infrastructure
}

export interface TokenSwapSizes {
  HBAR: ParameterValue<number>;      // Core Hedera
  WBTC: ParameterValue<number>;      // Smart Contract Platforms
  SAUCE: ParameterValue<number>;     // DeFi & DEX Tokens
  USDC: ParameterValue<number>;      // Stablecoins
  JAM: ParameterValue<number>;       // Enterprise & Utility Tokens
  HEADSTART: ParameterValue<number>; // GameFi & NFT Infrastructure
}

// Fee Parameters
export interface FeeParameters {
  mintingFee: number;     // 0.1, 0.2, 0.3, 0.5 %
  burningFee: number;     // 0.1, 0.2, 0.3, 0.5 %
  operationalFee: number; // 0.05, 0.1, 0.2, 0.3 %
}

// Governance Parameters
export interface GovernanceParameters {
  quorumPercentage: number;   // 10, 15, 20, 25, 30 %
  votingPeriodHours: number;  // 48, 72, 96, 168 hours
  proposalThreshold: number;  // 500, 1000, 2500, 5000 LYNX tokens
}

export interface ParameterMetadata {
  version: string;
  lastUpdated: string;
  updatedBy: string;
  networkState: 'mainnet' | 'testnet' | 'previewnet';
  topicId: string;
  sequenceNumber?: number;
}

// Supported tokens in the Lynx index (6 tokens representing 6 sectors)
export const LYNX_TOKENS = ['HBAR', 'WBTC', 'SAUCE', 'USDC', 'JAM', 'HEADSTART'] as const;
export type LynxTokenSymbol = typeof LYNX_TOKENS[number];

// Token metadata for display
export interface LynxTokenInfo {
  symbol: LynxTokenSymbol;
  name: string;
  description: string;
  sector: string;
  website?: string;
  tokenId?: string;
}

// Default token information
export const TOKEN_INFO: Record<LynxTokenSymbol, LynxTokenInfo> = {
  HBAR: {
    symbol: 'HBAR',
    name: 'Hedera Hashgraph',
    description: 'Native Hedera network token',
    sector: 'Core Hedera',
    website: 'https://hedera.com',
    tokenId: '0.0.0'
  },
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    description: 'Bitcoin wrapped for smart contract platforms',
    sector: 'Smart Contract Platforms',
    website: 'https://wbtc.network'
  },
  SAUCE: {
    symbol: 'SAUCE',
    name: 'SaucerSwap',
    description: 'Leading DEX on Hedera',
    sector: 'DeFi & DEX Tokens',
    website: 'https://saucerswap.finance'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    description: 'Fully-backed US dollar stablecoin',
    sector: 'Stablecoins',
    website: 'https://www.centre.io'
  },
  JAM: {
    symbol: 'JAM',
    name: 'JAM Token',
    description: 'Enterprise utility token',
    sector: 'Enterprise & Utility Tokens',
    website: 'https://jam.gg'
  },
  HEADSTART: {
    symbol: 'HEADSTART',
    name: 'HeadStarter',
    description: 'GameFi and NFT infrastructure token',
    sector: 'GameFi & NFT Infrastructure',
    website: 'https://headstarter.org'
  }
};

// Parameter validation ranges
export const PARAMETER_RANGES = {
  rebalancing: {
    frequencyHours: [4, 6, 12, 24, 48],
    thresholds: {
      normal: [5, 7, 10, 15],
      emergency: [10, 15, 20, 25]
    },
    cooldownPeriods: {
      normal: [24, 48, 72, 168],
      emergency: [0, 6, 12, 24]
    }
  },
  treasury: {
    weights: {
      HBAR: [20, 25, 30, 35, 40],      // Core Hedera
      WBTC: [10, 15, 20, 25],          // Smart Contract Platforms
      SAUCE: [10, 15, 20],             // DeFi & DEX Tokens
      USDC: [5, 10, 15, 20],           // Stablecoins
      JAM: [5, 10, 15],                // Enterprise & Utility Tokens
      HEADSTART: [5, 10, 15]           // GameFi & NFT Infrastructure
    },
    maxSlippage: {
      HBAR: [0.1, 0.5, 1.0, 2.0],
      others: [1.0, 2.0, 3.0, 5.0] // for all non-HBAR tokens
    },
    maxSwapSize: {
      HBAR: [100000, 500000, 1000000, 2000000],
      others: [50000, 100000, 250000, 500000] // for all non-HBAR tokens
    }
  },
  fees: {
    mintingFee: [0.1, 0.2, 0.3, 0.5],
    burningFee: [0.1, 0.2, 0.3, 0.5],
    operationalFee: [0.05, 0.1, 0.2, 0.3]
  },
  governance: {
    quorumPercentage: [10, 15, 20, 25, 30],
    votingPeriodHours: [48, 72, 96, 168],
    proposalThreshold: [500, 1000, 2500, 5000]
  }
} as const;

// Function to create default DAO parameters
export function createDefaultDaoParameters(): DaoParameters {
  return {
    rebalancing: {
      frequencyHours: 24, // Daily rebalancing
      thresholds: {
        normal: 10,    // 10% deviation triggers normal rebalance
        emergency: 20  // 20% deviation triggers emergency rebalance
      },
      cooldownPeriods: {
        normal: 48,    // 48 hour cooldown for normal rebalancing
        emergency: 12  // 12 hour cooldown for emergency rebalancing
      }
    },
    treasury: {
      weights: {
        HBAR: 25,      // 25% allocation to Core Hedera
        WBTC: 20,      // 20% allocation to Smart Contract Platforms
        SAUCE: 15,     // 15% allocation to DeFi & DEX Tokens
        USDC: 15,      // 15% allocation to Stablecoins
        JAM: 15,       // 15% allocation to Enterprise & Utility Tokens
        HEADSTART: 10  // 10% allocation to GameFi & NFT Infrastructure
      },
      maxSlippage: {
        HBAR: 1.0,      // 1% max slippage for Core Hedera
        WBTC: 2.0,      // 2% max slippage for Smart Contract Platforms
        SAUCE: 3.0,     // 3% max slippage for DeFi & DEX Tokens
        USDC: 0.5,      // 0.5% max slippage for Stablecoins
        JAM: 3.0,       // 3% max slippage for Enterprise & Utility Tokens
        HEADSTART: 5.0  // 5% max slippage for GameFi & NFT Infrastructure
      },
      maxSwapSize: {
        HBAR: 1000000,    // $1M max swap size for Core Hedera
        WBTC: 500000,     // $500K max swap size for Smart Contract Platforms
        SAUCE: 250000,    // $250K max swap size for DeFi & DEX Tokens
        USDC: 1000000,    // $1M max swap size for Stablecoins
        JAM: 100000,      // $100K max swap size for Enterprise & Utility Tokens
        HEADSTART: 50000  // $50K max swap size for GameFi & NFT Infrastructure
      }
    },
    fees: {
      mintingFee: 0.3,     // 0.3% minting fee
      burningFee: 0.3,     // 0.3% burning fee
      operationalFee: 0.1  // 0.1% operational fee
    },
    governance: {
      quorumPercentage: 20,   // 20% quorum required
      votingPeriodHours: 72,  // 72 hour voting period
      proposalThreshold: 1000 // 1000 LYNX required to create proposal
    },
    metadata: {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      updatedBy: "system",
      networkState: "testnet",
      topicId: "0.0.6110234"
    }
  };
}

// Helper function to extract value from parameter objects
export function getParameterValue<T>(param: ParameterValue<T>): T {
  if (typeof param === 'object' && param !== null && 'value' in param) {
    return (param as ParameterObject<T>).value;
  }
  return param as T;
} 