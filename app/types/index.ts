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
  HBAR: ParameterValue<number>;      // 20, 25, 30, 35, 40 %
  HSUITE: ParameterValue<number>;    // 10, 15, 20 %
  SAUCERSWAP: ParameterValue<number>; // 10, 15, 20 %
  HTS: ParameterValue<number>;       // 5, 10, 15 %
  HELI: ParameterValue<number>;      // 5, 10, 15 %
  KARATE: ParameterValue<number>;    // 5, 10, 15 %
  HASHPACK: ParameterValue<number>;  // 5, 10, 15 %
}

export interface TokenSlippage {
  HBAR: ParameterValue<number>;      // 0.1, 0.5, 1.0, 2.0 %
  HSUITE: ParameterValue<number>;    // 1.0, 2.0, 3.0, 5.0 %
  SAUCERSWAP: ParameterValue<number>; // 1.0, 2.0, 3.0, 5.0 %
  HTS: ParameterValue<number>;       // 1.0, 2.0, 3.0, 5.0 %
  HELI: ParameterValue<number>;      // 1.0, 2.0, 3.0, 5.0 %
  KARATE: ParameterValue<number>;    // 1.0, 2.0, 3.0, 5.0 %
  HASHPACK: ParameterValue<number>;  // 1.0, 2.0, 3.0, 5.0 %
}

export interface TokenSwapSizes {
  HBAR: ParameterValue<number>;      // 100000, 500000, 1000000, 2000000 USD
  HSUITE: ParameterValue<number>;    // 50000, 100000, 250000, 500000 USD
  SAUCERSWAP: ParameterValue<number>; // 50000, 100000, 250000, 500000 USD
  HTS: ParameterValue<number>;       // 50000, 100000, 250000, 500000 USD
  HELI: ParameterValue<number>;      // 50000, 100000, 250000, 500000 USD
  KARATE: ParameterValue<number>;    // 50000, 100000, 250000, 500000 USD
  HASHPACK: ParameterValue<number>;  // 50000, 100000, 250000, 500000 USD
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

// Supported tokens in the Lynx index
export const LYNX_TOKENS = ['HBAR', 'HSUITE', 'SAUCERSWAP', 'HTS', 'HELI', 'KARATE', 'HASHPACK'] as const;
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
    sector: 'Layer 1',
    website: 'https://hedera.com',
    tokenId: '0.0.0'
  },
  HSUITE: {
    symbol: 'HSUITE',
    name: 'HashSuite',
    description: 'Hedera development and infrastructure suite',
    sector: 'Infrastructure',
    website: 'https://hsuite.finance'
  },
  SAUCERSWAP: {
    symbol: 'SAUCERSWAP',
    name: 'SaucerSwap',
    description: 'Leading DEX on Hedera',
    sector: 'DeFi',
    website: 'https://saucerswap.finance'
  },
  HTS: {
    symbol: 'HTS',
    name: 'Hedera Token Service',
    description: 'Hedera native token standard',
    sector: 'Infrastructure'
  },
  HELI: {
    symbol: 'HELI',
    name: 'HeliSwap',
    description: 'Hedera DeFi protocol',
    sector: 'DeFi',
    website: 'https://heliswap.io'
  },
  KARATE: {
    symbol: 'KARATE',
    name: 'Karate Combat',
    description: 'Sports and entertainment token',
    sector: 'Entertainment',
    website: 'https://karate.com'
  },
  HASHPACK: {
    symbol: 'HASHPACK',
    name: 'HashPack',
    description: 'Leading Hedera wallet',
    sector: 'Infrastructure',
    website: 'https://hashpack.app'
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
      HBAR: [20, 25, 30, 35, 40],
      HSUITE: [10, 15, 20],
      SAUCERSWAP: [10, 15, 20],
      HTS: [5, 10, 15],
      HELI: [5, 10, 15],
      KARATE: [5, 10, 15],
      HASHPACK: [5, 10, 15]
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
        HBAR: 30,      // 30% allocation to HBAR
        HSUITE: 15,    // 15% allocation to HSUITE
        SAUCERSWAP: 15, // 15% allocation to SAUCERSWAP
        HTS: 10,       // 10% allocation to HTS
        HELI: 10,      // 10% allocation to HELI
        KARATE: 10,    // 10% allocation to KARATE
        HASHPACK: 10   // 10% allocation to HASHPACK
      },
      maxSlippage: {
        HBAR: 1.0,      // 1% max slippage for HBAR
        HSUITE: 3.0,    // 3% max slippage for HSUITE
        SAUCERSWAP: 3.0, // 3% max slippage for SAUCERSWAP
        HTS: 3.0,       // 3% max slippage for HTS
        HELI: 3.0,      // 3% max slippage for HELI
        KARATE: 3.0,    // 3% max slippage for KARATE
        HASHPACK: 3.0   // 3% max slippage for HASHPACK
      },
      maxSwapSize: {
        HBAR: 1000000,    // $1M max swap size for HBAR
        HSUITE: 250000,   // $250K max swap size for HSUITE
        SAUCERSWAP: 250000, // $250K max swap size for SAUCERSWAP
        HTS: 100000,      // $100K max swap size for HTS
        HELI: 100000,     // $100K max swap size for HELI
        KARATE: 100000,   // $100K max swap size for KARATE
        HASHPACK: 100000  // $100K max swap size for HASHPACK
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