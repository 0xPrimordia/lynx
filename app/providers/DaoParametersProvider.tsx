'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DaoParameters } from '../types';
import { HCSService, HCSMessage, getHCSService } from '../services/hcsService';

interface DaoParametersContextType {
  parameters: DaoParameters | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  lastUpdated: string | null;
  recentMessages: HCSMessage[];
  
  // Actions
  refreshParameters: () => Promise<void>;
  subscribeToUpdates: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  sendGovernanceMessage: (message: string) => Promise<string>;
}

const DaoParametersContext = createContext<DaoParametersContextType | undefined>(undefined);

interface DaoParametersProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
}

export function DaoParametersProvider({ children, autoConnect = true }: DaoParametersProviderProps) {
  const [parameters, setParameters] = useState<DaoParameters | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [recentMessages, setRecentMessages] = useState<HCSMessage[]>([]);
  const [hcsService] = useState<HCSService>(() => getHCSService());

  const createDefaultParameters = useCallback((): DaoParameters => {
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
  }, []);

  // Transform API response to match frontend expectations
  const transformApiParameters = (apiParams: Record<string, unknown>): DaoParameters => {

    const transformObject = (obj: unknown): unknown => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      // Handle arrays by transforming each element
      if (Array.isArray(obj)) {
        return obj.map(item => transformObject(item));
      }
      
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Check if this is a parameter object with {value, options, ...}
        if (typeof value === 'object' && value !== null && 'value' in value) {
          result[key] = (value as { value: unknown }).value;
          console.log(`Extracted value for ${key}:`, (value as { value: unknown }).value, 'from:', value);
        } else if (Array.isArray(value)) {
          // Handle arrays
          result[key] = value.map(item => transformObject(item));
        } else if (typeof value === 'object' && value !== null) {
          // Recursively transform nested objects
          result[key] = transformObject(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    console.log('Starting transformation of:', apiParams);
    const transformed = transformObject(apiParams);
    console.log('Transformation complete:', transformed);
    return transformed as DaoParameters;
  };

  // Load persisted parameters on mount
  useEffect(() => {
    const loadParameters = async () => {
      setIsLoading(true);
      
      try {
        // First try to fetch from our API route
        console.log('Fetching DAO parameters from API...');
        const response = await fetch('/api/governance/parameters');
        
        if (response.ok) {
          const apiData = await response.json();
          console.log('Successfully loaded DAO parameters from API');
          console.log('Raw API data structure:', JSON.stringify(apiData.parameters, null, 2).substring(0, 1000) + '...');
          
          // Transform the complex API structure to simple values
          const transformedParams = transformApiParameters(apiData.parameters);
          console.log('Transformed parameters structure:', JSON.stringify(transformedParams, null, 2).substring(0, 1000) + '...');
          
          // Specifically check treasury weights transformation
          console.log('Treasury weights after transformation:', transformedParams.treasury?.weights);
          
          setParameters(transformedParams);
          setLastUpdated(apiData.metadata?.timestamp || new Date().toISOString());
          setIsLoading(false);
          return;
        } else {
          console.error('API fetch failed, falling back to persisted parameters');
        }
      } catch (error) {
        console.error('Failed to fetch from API, falling back to persisted parameters:', error);
      }
      
      // Fallback to persisted parameters
      const persistedParams = hcsService.getPersistedParameters();
      const timestamp = hcsService.getParametersTimestamp();
      
      if (persistedParams) {
        setParameters(persistedParams);
        setLastUpdated(timestamp);
        console.log('Loaded persisted DAO parameters');
      } else {
        // Set default parameters if none exist
        setParameters(createDefaultParameters());
        console.log('Using default DAO parameters');
      }
      
      setIsLoading(false);
    };

    loadParameters();
  }, [hcsService, createDefaultParameters]);

  // Auto-connect on mount if enabled (moved after subscribeToUpdates definition)

  const handleHCSMessage = useCallback((message: HCSMessage) => {
    console.log('Received HCS message:', message);
    
    // Add to recent messages (keep last 50)
    setRecentMessages(prev => {
      const updated = [message, ...prev].slice(0, 50);
      return updated;
    });
  }, []);

  const handleParametersUpdate = useCallback((newParameters: DaoParameters) => {
    console.log('DAO parameters updated:', newParameters);
    setParameters(newParameters);
    setLastUpdated(new Date().toISOString());
    setError(null);
  }, []);

  const subscribeToUpdates = useCallback(async () => {
    if (isConnected) return;

    setIsLoading(true);
    setError(null);

    try {
      await hcsService.initialize();
      
      await hcsService.subscribeToGovernanceTopic(
        handleHCSMessage,
        handleParametersUpdate
      );

      setIsConnected(true);
      console.log('Successfully subscribed to DAO parameter updates');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe to governance topic';
      setError(errorMessage);
      console.error('Failed to subscribe to DAO parameter updates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, hcsService, handleHCSMessage, handleParametersUpdate]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && !isConnected) {
      subscribeToUpdates().catch(console.error);
    }
  }, [autoConnect, isConnected, subscribeToUpdates]);

  const unsubscribe = useCallback(async () => {
    if (!isConnected) return;

    try {
      await hcsService.unsubscribe();
      setIsConnected(false);
      console.log('Unsubscribed from DAO parameter updates');
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
    }
  }, [isConnected, hcsService]);

  const refreshParameters = useCallback(async () => {
    // For now, just reload from localStorage
    // In a full implementation, this might trigger a specific query or refresh
    const persistedParams = hcsService.getPersistedParameters();
    const timestamp = hcsService.getParametersTimestamp();
    
    if (persistedParams) {
      setParameters(persistedParams);
      setLastUpdated(timestamp);
    }
  }, [hcsService]);

  const sendGovernanceMessage = useCallback(async (message: string): Promise<string> => {
    if (!isConnected) {
      throw new Error('Not connected to governance topic');
    }

    try {
      const transactionId = await hcsService.sendMessage(message);
      console.log('Sent governance message:', { message, transactionId });
      return transactionId;
    } catch (err) {
      console.error('Failed to send governance message:', err);
      throw err;
    }
  }, [isConnected, hcsService]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        unsubscribe().catch(console.error);
      }
    };
  }, [isConnected, unsubscribe]);

  const contextValue: DaoParametersContextType = {
    parameters,
    isLoading,
    isConnected,
    error,
    lastUpdated,
    recentMessages,
    refreshParameters,
    subscribeToUpdates,
    unsubscribe,
    sendGovernanceMessage,
  };

  return (
    <DaoParametersContext.Provider value={contextValue}>
      {children}
    </DaoParametersContext.Provider>
  );
}

export function useDaoParameters(): DaoParametersContextType {
  const context = useContext(DaoParametersContext);
  if (context === undefined) {
    throw new Error('useDaoParameters must be used within a DaoParametersProvider');
  }
  return context;
} 