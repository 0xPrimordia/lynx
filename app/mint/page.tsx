"use client";

import React from 'react';
import { useWallet } from '../providers/WalletProvider';
import { useTokenQueue } from '../providers/TokenQueueProvider';
import { useTokens } from '../hooks/useTokens';
import { useDaoParameters } from '../providers/DaoParametersProvider';
import { MintForm } from '../components/MintForm';

export default function MintPage() {
  const { isConnected, accountId } = useWallet();
  const { queueStats, isProcessing } = useTokenQueue();
  const { tokenBalances, tokenPrices, isLoading: isLoadingTokens } = useTokens();
  const { parameters } = useDaoParameters();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Mint LYNX Tokens
            </h1>
            <p className="text-gray-300 text-lg">
              Convert your HBAR, SAUCE, and CLXY tokens into LYNX
            </p>
          </div>

          {/* Connection Status */}
          {!isConnected && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
              <p className="text-yellow-200 text-center">
                Please connect your wallet to start minting LYNX tokens
              </p>
            </div>
          )}

          {/* Queue Status */}
          {isProcessing && (
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-blue-200">Processing transactions...</span>
                <div className="flex items-center space-x-4 text-sm text-blue-300">
                  <span>Pending: {queueStats.pendingTransactions}</span>
                  <span>Completed: {queueStats.completedTransactions}</span>
                  <span>Failed: {queueStats.failedTransactions}</span>
                </div>
              </div>
            </div>
          )}

                     {/* Main Mint Form */}
           <MintForm />

          {/* Token Balances */}
          {isConnected && accountId && (
            <div className="mt-8 bg-gray-800/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Your Token Balances</h3>
              
              {isLoadingTokens ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                  <p className="text-gray-400 mt-2">Loading balances...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(tokenBalances).map(([token, balance]) => (
                    <div key={token} className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 font-medium">{token}</span>
                        <span className="text-white font-bold">
                          {typeof balance === 'number' ? balance.toLocaleString() : balance}
                        </span>
                      </div>
                                             {tokenPrices[token as keyof typeof tokenPrices] && (
                         <div className="text-sm text-gray-400 mt-1">
                           ${tokenPrices[token as keyof typeof tokenPrices]?.toFixed(4)} USD
                         </div>
                       )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DAO Parameters Status */}
          {parameters && (
            <div className="mt-8 bg-gray-800/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Current DAO Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                 <div>
                   <span className="text-gray-400">Minting Fee:</span>
                   <span className="text-white ml-2">{typeof parameters.fees.mintingFee === 'number' ? parameters.fees.mintingFee : (parameters.fees.mintingFee as { value: number })?.value || 'N/A'}%</span>
                 </div>
                 <div>
                   <span className="text-gray-400">Rebalancing Frequency:</span>
                   <span className="text-white ml-2">{typeof parameters.rebalancing.frequencyHours === 'number' ? parameters.rebalancing.frequencyHours : (parameters.rebalancing.frequencyHours as { value: number })?.value || 'N/A'}h</span>
                 </div>
                 <div>
                   <span className="text-gray-400">HBAR Weight:</span>
                   <span className="text-white ml-2">{typeof parameters.treasury.weights.HBAR === 'number' ? parameters.treasury.weights.HBAR : (parameters.treasury.weights.HBAR as { value: number })?.value || 'N/A'}%</span>
                 </div>
                 <div>
                   <span className="text-gray-400">Version:</span>
                   <span className="text-white ml-2">{parameters.metadata.version}</span>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 