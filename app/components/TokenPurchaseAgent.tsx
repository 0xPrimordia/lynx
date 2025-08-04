"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useTokens } from '../hooks/useTokens';
import { useDaoParameters } from '../providers/DaoParametersProvider';
import { useWallet } from '../providers/WalletProvider';
import { TokenPurchaseService } from '../services/tokenPurchaseService';
import { useToast } from '../hooks/useToast';

interface TokenPurchaseAgentProps {
  className?: string;
}

export function TokenPurchaseAgent({ className = "" }: TokenPurchaseAgentProps) {
  const [hbarAmount, setHbarAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAssociation, setNeedsAssociation] = useState<string[]>([]);
  const [isAssociating, setIsAssociating] = useState(false);
  const { tokenPrices, isLoading: isLoadingTokens } = useTokens();
  const { parameters } = useDaoParameters();
  const { isConnected, accountId, dAppConnector } = useWallet();
  const { toast } = useToast();

  // Calculate token amounts based on HBAR input and current prices
  const tokenAmounts = useMemo(() => {
    if (!hbarAmount || !tokenPrices || !parameters) return null;

    const hbarValue = parseFloat(hbarAmount);
    if (isNaN(hbarValue) || hbarValue <= 0) return null;

    const hbarPrice = tokenPrices.HBAR;
    if (!hbarPrice) return null;

    const totalValueUSD = hbarValue * hbarPrice;
    const weights = parameters.treasury.weights;

    // Helper function to get weight value
    const getWeightValue = (weight: unknown): number => {
      if (typeof weight === 'number') return weight;
      if (typeof weight === 'object' && weight !== null && 'value' in weight) {
        return (weight as { value: number }).value;
      }
      return 0;
    };

    const tokenAmounts: Record<string, { amount: number; valueUSD: number; weight: number }> = {};

    // Calculate amounts for each token based on weights
    Object.entries(weights).forEach(([token, weight]) => {
      if (token === 'HBAR') return; // Skip HBAR as it's the input

      const tokenWeight = getWeightValue(weight);
      const tokenPrice = tokenPrices[token as keyof typeof tokenPrices];
      
      if (tokenPrice && tokenWeight > 0) {
        const valueUSD = (totalValueUSD * tokenWeight) / 100;
        const amount = valueUSD / tokenPrice;
        
        tokenAmounts[token] = {
          amount,
          valueUSD,
          weight: tokenWeight
        };
      }
    });

    return tokenAmounts;
  }, [hbarAmount, tokenPrices, parameters]);

  const handlePurchase = useCallback(async () => {
    if (!isConnected || !accountId || !dAppConnector) {
      setError('Please connect your wallet first');
      return;
    }

    if (!hbarAmount || parseFloat(hbarAmount) <= 0) {
      setError('Please enter a valid HBAR amount');
      return;
    }

    if (!tokenAmounts) {
      setError('Unable to calculate token amounts. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      const purchaseService = new TokenPurchaseService();
      
      // Check if operator has sufficient balances
      const balanceCheck = await purchaseService.checkOperatorBalances(tokenAmounts);
      if (!balanceCheck.sufficient) {
        setError(`Insufficient operator balances for: ${balanceCheck.insufficientTokens.join(', ')}`);
        return;
      }

      // Execute the token purchase
      const result = await purchaseService.executeTokenPurchase(
        {
          hbarAmount: parseFloat(hbarAmount),
          userAccountId: accountId,
          tokenAmounts
        },
        dAppConnector
      );

      if (result.success) {
        // Success - clear form and show success message
        setHbarAmount('');
        toast.success(`Purchase completed successfully! Transaction ID: ${result.txId}`);
        toast.info('You have received the tokens in your wallet.');
      } else if (result.needsAssociation && result.unassociatedTokens) {
        // Need to associate tokens first
        setNeedsAssociation(result.unassociatedTokens);
        setError(`Tokens need to be associated: ${result.unassociatedTokens.join(', ')}`);
      } else {
        setError(`Purchase failed: ${result.error}`);
      }

      purchaseService.close();
    } catch (error) {
      console.error('Purchase failed:', error);
      setError(error instanceof Error ? error.message : 'Purchase failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [isConnected, accountId, dAppConnector, hbarAmount, tokenAmounts]);

  const handleAssociateTokens = useCallback(async () => {
    if (!isConnected || !accountId || !dAppConnector || needsAssociation.length === 0) {
      setError('Cannot associate tokens - wallet not connected or no tokens to associate');
      return;
    }

    setIsAssociating(true);
    setError(null);
    
    try {
      const purchaseService = new TokenPurchaseService();
      
      const result = await purchaseService.associateTokensWithUser(
        needsAssociation,
        accountId,
        dAppConnector
      );

      purchaseService.close();

      if (result.success) {
        setNeedsAssociation([]);
        toast.success('Tokens associated successfully! You can now proceed with the purchase.');
      } else {
        setError(`Token association failed: ${result.error}`);
      }

    } catch (error) {
      console.error('Token association failed:', error);
      setError(error instanceof Error ? error.message : 'Token association failed. Please try again.');
    } finally {
      setIsAssociating(false);
    }
  }, [isConnected, accountId, dAppConnector, needsAssociation, toast]);

  const formatTokenAmount = (amount: number, token: string): string => {
    if (amount < 0.0001) return '< 0.0001';
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
    return amount.toFixed(4);
  };

  const formatUSD = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className={`bg-gray-800/50 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">Token Purchase Agent</h3>
        <div className="text-sm text-gray-400">
          Exchange HBAR for portfolio tokens
        </div>
      </div>

      {!isConnected && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
          <p className="text-yellow-200 text-sm">
            Please connect your wallet to use the Token Purchase Agent
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-200 text-sm">
            {error}
          </p>
        </div>
      )}

      {/* HBAR Input */}
      <div className="mb-6">
        <label htmlFor="hbar-amount" className="block text-sm font-medium text-gray-300 mb-2">
          HBAR Amount
        </label>
        <div className="relative">
          <input
            id="hbar-amount"
            type="number"
            value={hbarAmount}
            onChange={(e) => {
              setHbarAmount(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter HBAR amount"
            min="0"
            step="0.01"
            disabled={!isConnected || isProcessing}
            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0159E0] focus:border-transparent disabled:bg-gray-600/50 disabled:cursor-not-allowed"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            HBAR
          </div>
        </div>
        {hbarAmount && tokenPrices?.HBAR && (
          <div className="mt-2 text-sm text-gray-400">
            ≈ {formatUSD(parseFloat(hbarAmount) * tokenPrices.HBAR)} USD
          </div>
        )}
      </div>

      {/* Token Breakdown */}
      {tokenAmounts && Object.keys(tokenAmounts).length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-medium text-white mb-3">Tokens You'll Receive</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(tokenAmounts).map(([token, data]) => (
              <div key={token} className="bg-gray-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium">{token}</span>
                  <span className="text-gray-400 text-sm">{data.weight}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#0159E0] font-bold">
                    {formatTokenAmount(data.amount, token)}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {formatUSD(data.valueUSD)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={!isConnected || !hbarAmount || parseFloat(hbarAmount) <= 0 || isProcessing || isLoadingTokens || !!error || needsAssociation.length > 0}
        className="w-full px-6 py-3 bg-[#0159E0] hover:bg-[#0147c4] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Processing Purchase...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Purchase Tokens</span>
          </>
        )}
      </button>

      {/* Association Button */}
      {needsAssociation.length > 0 && (
        <button
          onClick={handleAssociateTokens}
          disabled={!isConnected || isAssociating}
          className="w-full mt-3 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          {isAssociating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Associating Tokens...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Associate {needsAssociation.length} Token{needsAssociation.length > 1 ? 's' : ''}</span>
            </>
          )}
        </button>
      )}

      {/* Info Text */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>COMING SOON:This agent will exchange your HBAR for the optimal token mix based on current DAO parameters.</p>
        <p className="mt-1">Future versions will include automated DEX routing and slippage protection.</p>
      </div>
    </div>
  );
} 