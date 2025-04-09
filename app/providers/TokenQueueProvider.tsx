"use client";

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { TokenQueueService, MintParams } from '../services/TokenQueueService';
import { useWallet } from './WalletProvider';
import { QueueStats } from '../services/TransactionQueueManager';

interface TokenQueueContextProps {
  queueTokenApproval: (tokenName: string, amount: number) => Promise<string>;
  mintLynx: (params: MintParams) => Promise<{
    sauceApprovalId: string;
    clxyApprovalId: string;
    mintId: string;
  }>;
  getTransactionStatus: (id: string) => any;
  queueStats: QueueStats;
  isProcessing: boolean;
  getTokenRatios: () => { hbarRatio: number; sauceRatio: number; clxyRatio: number; };
  calculateRequiredHBAR: (lynxAmount: number) => number;
}

// Create context with default values
const TokenQueueContext = createContext<TokenQueueContextProps>({
  queueTokenApproval: async () => '',
  mintLynx: async () => ({ sauceApprovalId: '', clxyApprovalId: '', mintId: '' }),
  getTransactionStatus: () => null,
  queueStats: { totalTransactions: 0, completedTransactions: 0, failedTransactions: 0, pendingTransactions: 0 },
  isProcessing: false,
  getTokenRatios: () => ({ hbarRatio: 0, sauceRatio: 0, clxyRatio: 0 }),
  calculateRequiredHBAR: () => 0
});

export const TokenQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { dAppConnector, accountId } = useWallet();
  const [tokenQueueService, setTokenQueueService] = useState<TokenQueueService | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats>({
    totalTransactions: 0,
    completedTransactions: 0,
    failedTransactions: 0,
    pendingTransactions: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize token queue service
  useEffect(() => {
    const service = new TokenQueueService();
    service.updateConnection(dAppConnector, accountId);
    setTokenQueueService(service);
    
    // Poll for queue status updates
    const interval = setInterval(() => {
      if (service) {
        const stats = service.getQueueStats();
        setQueueStats(stats);
        setIsProcessing(stats.pendingTransactions > 0);
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [dAppConnector, accountId]);

  // Update connection when wallet changes
  useEffect(() => {
    if (tokenQueueService) {
      tokenQueueService.updateConnection(dAppConnector, accountId);
    }
  }, [dAppConnector, accountId, tokenQueueService]);

  // Queue a token approval transaction
  const queueTokenApproval = useCallback(async (tokenName: string, amount: number): Promise<string> => {
    if (!tokenQueueService) {
      throw new Error('Token queue service not initialized');
    }
    
    // Get token configuration based on token name
    const tokenConfig = tokenQueueService.getTokenConfig(tokenName);
    if (!tokenConfig) {
      throw new Error(`Unknown token: ${tokenName}`);
    }
    
    return tokenQueueService.queueTokenApproval({
      tokenName,
      amount,
      tokenId: tokenConfig.tokenId || '',
      contractId: tokenConfig.contractId
    });
  }, [tokenQueueService]);

  // Queue a LYNX mint operation
  const mintLynx = useCallback(async (params: MintParams) => {
    if (!tokenQueueService) {
      throw new Error('Token queue service not initialized');
    }
    
    return tokenQueueService.queueMintLynx(params);
  }, [tokenQueueService]);

  // Get transaction status
  const getTransactionStatus = useCallback((id: string) => {
    if (!tokenQueueService) {
      return null;
    }
    
    return tokenQueueService.getTransaction(id);
  }, [tokenQueueService]);

  // Get token ratios
  const getTokenRatios = useCallback(() => {
    if (!tokenQueueService) {
      return { hbarRatio: 0, sauceRatio: 0, clxyRatio: 0 };
    }
    
    return tokenQueueService.getTokenRatios();
  }, [tokenQueueService]);

  // Calculate required HBAR
  const calculateRequiredHBAR = useCallback((lynxAmount: number) => {
    if (!tokenQueueService) {
      return 0;
    }
    
    return tokenQueueService.calculateRequiredHBAR(lynxAmount);
  }, [tokenQueueService]);

  // Provide the context value
  const contextValue = {
    queueTokenApproval,
    mintLynx,
    getTransactionStatus,
    queueStats,
    isProcessing,
    getTokenRatios,
    calculateRequiredHBAR
  };

  return (
    <TokenQueueContext.Provider value={contextValue}>
      {children}
    </TokenQueueContext.Provider>
  );
};

// Hook to use the token queue context
export const useTokenQueue = () => useContext(TokenQueueContext); 