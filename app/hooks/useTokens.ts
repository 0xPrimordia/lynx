// Stub interface for useTokens hook
export interface TokenAmount {
  amount: number;
  decimals: number;
}

export interface TokensNeeded {
  SAUCE: {
    amount: number;
    formatted: string;
  };
  CLXY: {
    amount: number;
    formatted: string;
  };
}

export interface UseTokensReturn {
  requiredTokens: {
    SAUCE: TokenAmount;
    CLXY: TokenAmount;
  };
  formatAmount: (amount: number) => string;
  calculateTokensNeeded: (lynxAmount: number) => TokensNeeded;
}

// Types for governance section
export interface Token {
  id: string;
  symbol: string;
  name: string;
  icon: string;
}

export interface SaucerSwapContextType {
  tokens: Token[];
  loading: boolean;
  error: string | null;
}

// Actual implementation of useTokens hook
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from './useWallet';
import { BalanceService } from '../services/balanceService';
import { useDaoParameters } from '../providers/DaoParametersProvider';

// Token IDs from environment variables or defaults
const LYNX_TOKEN_ID = process.env.NEXT_PUBLIC_LYNX_TOKEN_ID || "0.0.5948419";
const SAUCE_TOKEN_ID = process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID || "0.0.1183558";
const WBTC_TOKEN_ID = process.env.NEXT_PUBLIC_WBTC_TOKEN_ID || "0.0.6212930";
const USDC_TOKEN_ID = process.env.NEXT_PUBLIC_USDC_TOKEN_ID || "0.0.6212931";
const JAM_TOKEN_ID = process.env.NEXT_PUBLIC_JAM_TOKEN_ID || "0.0.6212932";
const HEADSTART_TOKEN_ID = process.env.NEXT_PUBLIC_HEADSTART_TOKEN_ID || "0.0.6212933";
const LYNX_CONTRACT_ID = process.env.NEXT_PUBLIC_LYNX_CONTRACT_ID || "0.0.5758264";

export interface TokenIds {
  SAUCE: string;
  WBTC: string;
  USDC: string;
  JAM: string;
  HEADSTART: string;
  LYNX: string;
  CONTRACT: string;
}

export interface TokenBalances {
  HBAR: string;
  SAUCE: string;
  WBTC: string;
  USDC: string;
  JAM: string;
  HEADSTART: string;
  LYNX: string;
}

export interface TokenPrices {
  HBAR: number;
  SAUCE: number;
  WBTC: number;
  USDC: number;
  JAM: number;
  HEADSTART: number;
  LYNX: number;
}

export interface RequiredTokens {
  HBAR: number;
  SAUCE: number;
  WBTC: number;
  USDC: number;
  JAM: number;
  HEADSTART: number;
}

export interface UseTokensResult {
  tokenIds: TokenIds;
  tokenBalances: TokenBalances;
  tokenPrices: TokenPrices;
  requiredTokens: RequiredTokens;
  isLoading: boolean;
  error: Error | null;
  refreshBalances: () => Promise<boolean>;
  calculateRequiredTokens: (lynxAmount: number) => RequiredTokens;
  formatTokenAmount: (amount: number, tokenType: string) => string;
}

// Mock token data for governance section
const mockTokens: Token[] = [
  { id: '1', symbol: 'HBAR', name: 'Hedera Hashgraph', icon: 'hbar-icon' },
  { id: '2', symbol: 'SAUCE', name: 'SaucerSwap Token', icon: 'sauce-icon' },
  { id: '3', symbol: 'USDC', name: 'USD Coin', icon: 'usdc-icon' },
  { id: '4', symbol: 'WETH', name: 'Wrapped Ethereum', icon: 'weth-icon' }
];

export const useSaucerSwapContext = () => {
  return {
    tokens: mockTokens,
    loading: false,
    error: null
  };
};

export function useTokens(): UseTokensResult {
  const { account, isConnected } = useWallet();
  const { parameters } = useDaoParameters();
  const [tokenBalances, setTokenBalances] = useState<TokenBalances>({
    HBAR: '0',
    SAUCE: '0',
    WBTC: '0',
    USDC: '0',
    JAM: '0',
    HEADSTART: '0',
    LYNX: '0'
  });
  const [tokenPrices] = useState<TokenPrices>({
    HBAR: 0.065,
    SAUCE: 0.01,
    WBTC: 45000,
    USDC: 1.00,
    JAM: 0.15,
    HEADSTART: 0.05,
    LYNX: 0.03
  });
  const [requiredTokens] = useState<RequiredTokens>({
    HBAR: 0,
    SAUCE: 0,
    WBTC: 0,
    USDC: 0,
    JAM: 0,
    HEADSTART: 0
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [balanceService] = useState<BalanceService>(() => new BalanceService());
  
  // Token IDs are constant
  const tokenIds: TokenIds = {
    SAUCE: SAUCE_TOKEN_ID,
    WBTC: WBTC_TOKEN_ID,
    USDC: USDC_TOKEN_ID,
    JAM: JAM_TOKEN_ID,
    HEADSTART: HEADSTART_TOKEN_ID,
    LYNX: LYNX_TOKEN_ID,
    CONTRACT: LYNX_CONTRACT_ID
  };

  // Function to refresh balances using real Hedera SDK queries
  const refreshBalances = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !account?.accountId) {
      console.log('[useTokens] Wallet not connected, skipping balance refresh');
      return false;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[useTokens] Fetching real balances from Hedera network...');
      
      // Use the BalanceService to get real balances
      const realBalances = await balanceService.getTokenBalances(account.accountId);
      
      console.log('[useTokens] Real balances fetched:', realBalances);
      setTokenBalances(realBalances);
      
      return true;
    } catch (err) {
      console.error('[useTokens] Error fetching real balances:', err);
      setError(err instanceof Error ? err : new Error('Failed to refresh balances'));
      
      // Fallback to default values on error
      setTokenBalances({
        HBAR: '0',
        SAUCE: '0',
        WBTC: '0',
        USDC: '0',
        JAM: '0',
        HEADSTART: '0',
        LYNX: '0'
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, account?.accountId, balanceService]);

  // Memoize the weights to prevent infinite re-renders (removed as not used)

  // Create a stable reference to the weights (removed as not used)

  // Calculate required tokens based on LYNX amount using snapshot ratios
  const calculateRequiredTokens = useCallback((lynxAmount: number): RequiredTokens => {
    if (!lynxAmount || lynxAmount <= 0) {
      return { HBAR: 0, SAUCE: 0, WBTC: 0, USDC: 0, JAM: 0, HEADSTART: 0 };
    }
    
    try {
      // Use snapshot ratios if available, otherwise fall back to hardcoded contract ratios
      if (parameters?.treasury?.weights) {
        // Extract values from DAO parameters (handle both simple values and ParameterObject format)
        const getWeightValue = (weight: unknown): number => {
          if (typeof weight === 'object' && weight !== null && 'value' in weight) {
            return (weight as { value: number }).value;
          }
          return weight as number;
        };

        const snapshotWeights = {
          HBAR: getWeightValue(parameters.treasury.weights.HBAR),
          WBTC: getWeightValue(parameters.treasury.weights.WBTC),
          SAUCE: getWeightValue(parameters.treasury.weights.SAUCE),
          USDC: getWeightValue(parameters.treasury.weights.USDC),
          JAM: getWeightValue(parameters.treasury.weights.JAM),
          HEADSTART: getWeightValue(parameters.treasury.weights.HEADSTART)
        };

        // These are the real ratio values, do not change them
        const snapshotRatios = {
          HBAR: snapshotWeights.HBAR,
          WBTC: snapshotWeights.WBTC,
          SAUCE: snapshotWeights.SAUCE,
          USDC: snapshotWeights.USDC,
          JAM: snapshotWeights.JAM,
          HEADSTART: snapshotWeights.HEADSTART
        };
        
        console.log('[useTokens] Using snapshot ratios for token calculation:', snapshotRatios);
        
        // Calculate required tokens by multiplying ratios by LYNX amount and dividing by 10
        return {
          HBAR: (lynxAmount * snapshotRatios.HBAR) / 10,
          WBTC: (lynxAmount * snapshotRatios.WBTC) / 10,
          SAUCE: (lynxAmount * snapshotRatios.SAUCE) / 10,
          USDC: (lynxAmount * snapshotRatios.USDC) / 10,
          JAM: (lynxAmount * snapshotRatios.JAM) / 10,
          HEADSTART: (lynxAmount * snapshotRatios.HEADSTART) / 10
        };
      } else {
        // Fallback to hardcoded contract ratios if no snapshot data
        const fallbackRatios = {
          HBAR: 50,      // Contract HBAR_RATIO = 50
          WBTC: 0.3,     // Contract WBTC_RATIO = 3  
          SAUCE: 25,     // Contract SAUCE_RATIO = 25
          USDC: 15,      // Contract USDC_RATIO = 15
          JAM: 5,       // Contract JAM_RATIO = 5
          HEADSTART: 3  // Contract HEADSTART_RATIO = 3
        };
        
        console.log('[useTokens] Using fallback ratios (no snapshot data):', fallbackRatios);
        
        return {
          HBAR: lynxAmount * fallbackRatios.HBAR,
          WBTC: lynxAmount * fallbackRatios.WBTC,
          SAUCE: lynxAmount * fallbackRatios.SAUCE,
          USDC: lynxAmount * fallbackRatios.USDC,
          JAM: lynxAmount * fallbackRatios.JAM,
          HEADSTART: lynxAmount * fallbackRatios.HEADSTART
        };
      }
    } catch (err) {
      console.error('[useTokens] Error calculating required tokens:', err);
      setError(err instanceof Error ? err : new Error('Failed to calculate required tokens'));
      return { HBAR: 0, SAUCE: 0, WBTC: 0, USDC: 0, JAM: 0, HEADSTART: 0 };
    }
  }, [parameters]);

  // Format token amounts with appropriate decimal places
  const formatTokenAmount = useCallback((amount: number, tokenType: string): string => {
    if (amount === 0) return '0';
    
    // Define decimal places for each token type
    const decimalPlaces: Record<string, number> = {
      HBAR: 2,      // 2 decimal places for HBAR
      WBTC: 4,      // 4 decimal places for WBTC (small amounts)
      SAUCE: 2,     // 2 decimal places for SAUCE
      USDC: 2,      // 2 decimal places for USDC
      JAM: 2,       // 2 decimal places for JAM
      HEADSTART: 2  // 2 decimal places for HEADSTART
    };
    
    const decimals = decimalPlaces[tokenType] || 2;
    return amount.toFixed(decimals);
  }, []);

  // Load initial data when wallet connects
  useEffect(() => {
    if (isConnected && account?.accountId) {
      console.log('[useTokens] Wallet connected, refreshing balances...');
      refreshBalances();
    } else {
      // Reset balances when wallet disconnects
      setTokenBalances({
        HBAR: '0',
        SAUCE: '0',
        WBTC: '0',
        USDC: '0',
        JAM: '0',
        HEADSTART: '0',
        LYNX: '0'
      });
    }
  }, [isConnected, account?.accountId, refreshBalances]);

  // Cleanup balance service on unmount
  useEffect(() => {
    return () => {
      if (balanceService) {
        balanceService.close();
      }
    };
  }, [balanceService]);

  return {
    tokenIds,
    tokenBalances,
    tokenPrices,
    requiredTokens,
    isLoading,
    error,
    refreshBalances,
    calculateRequiredTokens,
    formatTokenAmount
  };
}

export default useTokens; 