import { useState, useEffect, useCallback, useMemo } from 'react';
import { MirrorNodeService } from '../services/mirrorNodeService';
import { CONTRACT_IDS, TOKEN_IDS } from '../config/environment';

interface TokenData {
  contractBalances: Record<string, string>;
  totalSupply: string;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useTokenData() {
  const [tokenData, setTokenData] = useState<TokenData>({
    contractBalances: {},
    totalSupply: '0',
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  // Create service instance once
  const mirrorNodeService = useMemo(() => new MirrorNodeService(), []);

  // Get contract and token IDs from environment configuration
  const contractId = CONTRACT_IDS.LYNX;
  const lynxTokenId = TOKEN_IDS.LYNX;

  // Get all composition token IDs - memoize to prevent re-renders
  const compositionTokens = useMemo(() => ({
    SAUCE: TOKEN_IDS.SAUCE,
    WBTC: TOKEN_IDS.WBTC,
    USDC: TOKEN_IDS.USDC,
    JAM: TOKEN_IDS.JAM,
    HEADSTART: TOKEN_IDS.HEADSTART,
    CLXY: TOKEN_IDS.CLXY
  }), []);

  // Validate that we have proper IDs
  if (!contractId || contractId === '0x2531150c2C826c9Fc27f1479B07417510A6cc79a') {
    console.warn('[useTokenData] Invalid contract ID, using fallback');
  }
  if (!lynxTokenId || lynxTokenId === '0.0.6200902') {
    console.warn('[useTokenData] Invalid token ID, using fallback');
  }

  const fetchTokenData = useCallback(async () => {
    setTokenData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('[useTokenData] Fetching token data for contract:', contractId);
      
      // Fetch LYNX token info (includes total supply)
      const tokenInfo = await mirrorNodeService.getTokenInfo(lynxTokenId);
      console.log('[useTokenData] LYNX token info:', tokenInfo);
      
      // Fetch contract balances for all composition tokens
      const contractBalances: Record<string, string> = {};
      
      for (const [tokenName, tokenId] of Object.entries(compositionTokens)) {
        const balance = await mirrorNodeService.getTokenBalance(contractId, tokenId);
        contractBalances[tokenName] = balance;
        console.log(`[useTokenData] ${tokenName} balance:`, balance);
      }

      // Fetch HBAR balance
      const hbarBalance = await mirrorNodeService.getHbarBalance(contractId);
      contractBalances['HBAR'] = hbarBalance;
      console.log(`[useTokenData] HBAR balance:`, hbarBalance);

      if (tokenInfo) {
        setTokenData({
          contractBalances,
          totalSupply: tokenInfo.totalSupply,
          isLoading: false,
          error: null,
          lastUpdated: new Date()
        });
      } else {
        setTokenData(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to fetch token information'
        }));
      }
    } catch (error) {
      console.error('[useTokenData] Error fetching token data:', error);
      setTokenData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch token data'
      }));
    }
  }, [mirrorNodeService, contractId, lynxTokenId]);

  // Fetch data on mount
  useEffect(() => {
    fetchTokenData();
  }, [fetchTokenData]);

  // Format the data for display
  const formatTotalSupply = useCallback(() => {
    if (tokenData.totalSupply === '0') return '0';
    
    // Assuming 8 decimals for LYNX token
    const formatted = mirrorNodeService.formatTokenAmount(tokenData.totalSupply, 8);
    const numValue = parseFloat(formatted);
    return mirrorNodeService.formatNumber(numValue);
  }, [tokenData.totalSupply]);

  // Format individual token balance
  const formatTokenBalance = useCallback((balance: string, decimals: number = 8) => {
    if (balance === '0') return '0';
    
    const formatted = mirrorNodeService.formatTokenAmount(balance, decimals);
    const numValue = parseFloat(formatted);
    return mirrorNodeService.formatNumber(numValue);
  }, [mirrorNodeService]);

  // Format HBAR balance (8 decimals)
  const formatHbarBalance = useCallback((balance: string) => {
    if (balance === '0') return '0';
    
    const formatted = mirrorNodeService.formatTokenAmount(balance, 8);
    const numValue = parseFloat(formatted);
    return mirrorNodeService.formatNumber(numValue);
  }, [mirrorNodeService]);

  return {
    ...tokenData,
    formatTotalSupply,
    formatTokenBalance,
    formatHbarBalance,
    refresh: fetchTokenData
  };
} 