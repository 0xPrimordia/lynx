'use client';

import React from 'react';
import { VT323 } from "next/font/google";
import { useDaoParameters } from '../providers/DaoParametersProvider';
import { useTokenData } from '../hooks/useTokenData';

const vt323 = VT323({ weight: "400", subsets: ["latin"] });

export default function GovernancePage() {
  const { 
    parameters, 
    isLoading, 
    isConnected, 
    error, 
    lastUpdated,
    recentMessages 
  } = useDaoParameters();

  const {
    contractBalances,
    totalSupply,
    isLoading: tokenDataLoading,
    error: tokenDataError,
    lastUpdated: tokenDataLastUpdated,
    formatTotalSupply,
    formatTokenBalance,
    formatHbarBalance,
    refresh: refreshTokenData
  } = useTokenData();

  const formatNumber = (num: number): string => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function to extract values from potentially complex parameter objects
  const extractValue = (param: unknown): string | number => {
    if (typeof param === 'object' && param !== null && 'value' in param) {
      return (param as { value: string | number }).value;
    }
    return param as string | number;
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 max-w-2xl">
          <h3 className="text-lg font-medium text-red-300 mb-2">Connection Error</h3>
          <p className="text-red-400">{error}</p>
          <p className="text-sm text-gray-400 mt-2">
            Showing cached data. The governance system will continue to work with the last known parameters.
          </p>
        </div>
      </div>
    );
  }



  if (!parameters) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className={`text-2xl mb-4 ${vt323.className}`}>Loading DAO Parameters</h2>
          <p className="text-gray-400">Fetching governance configuration...</p>
        </div>
      </div>
    );
  }

  const { rebalancing, treasury, governance, metadata } = parameters;

  // Mock some state data for display since we don't have actual state yet
  const mockState = {
    totalLynxStaked: 15000000,
    totalLynxSupply: 100000000,
    stakeholderVotingRecords: [],
    nextRebalanceScheduled: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    treasuryBalance: {
      hbar: 50000000,
      otherTokens: treasury ? Object.keys(extractValue(treasury.weights) || {}) : []
    },
    currentTokenList: treasury ? Object.keys(extractValue(treasury.weights) || {}) : []
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold text-white mb-2 ${vt323.className}`}>
                Governance Overview
              </h1>
              <p className="text-gray-400">
                Monitor and participate in LYNX DAO governance
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-400">
                  {isConnected ? 'Connected to HCS' : 'Disconnected'}
                </span>
              </div>

              {lastUpdated && (
                <p className="text-xs text-gray-500">
                  Last updated: {formatDate(lastUpdated)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Total LYNX Supply</h3>
            {tokenDataLoading ? (
              <div className="flex items-center justify-center h-16">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : tokenDataError ? (
              <div className="text-red-400 text-sm">
                Error loading data
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-white">
                  {formatTotalSupply()} LYNX
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Circulating supply
                </p>
              </>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Your Staked LYNX</h3>
            <p className="text-3xl font-bold text-white">
              0 LYNX
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Staked for governance
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Your Voting Power</h3>
            <p className="text-3xl font-bold text-white">
              0%
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Based on staked tokens
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Contract SAUCE Balance</h3>
            {tokenDataLoading ? (
              <div className="flex items-center justify-center h-16">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : tokenDataError ? (
              <div className="text-red-400 text-sm">
                Error loading data
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-white">
                  {formatTokenBalance(contractBalances.SAUCE || '0')} SAUCE
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Vault contract balance
                </p>
              </>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Contract WBTC Balance</h3>
            {tokenDataLoading ? (
              <div className="flex items-center justify-center h-16">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : tokenDataError ? (
              <div className="text-red-400 text-sm">
                Error loading data
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-white">
                  {formatTokenBalance(contractBalances.WBTC || '0')} WBTC
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Vault contract balance
                </p>
              </>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Contract USDC Balance</h3>
            {tokenDataLoading ? (
              <div className="flex items-center justify-center h-16">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : tokenDataError ? (
              <div className="text-red-400 text-sm">
                Error loading data
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-white">
                  {formatTokenBalance(contractBalances.USDC || '0', 6)} USDC
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Vault contract balance
                </p>
              </>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Contract JAM Balance</h3>
            {tokenDataLoading ? (
              <div className="flex items-center justify-center h-16">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : tokenDataError ? (
              <div className="text-red-400 text-sm">
                Error loading data
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-white">
                  {formatTokenBalance(contractBalances.JAM || '0')} JAM
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Vault contract balance
                </p>
              </>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Contract HEADSTART Balance</h3>
            {tokenDataLoading ? (
              <div className="flex items-center justify-center h-16">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : tokenDataError ? (
              <div className="text-red-400 text-sm">
                Error loading data
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-white">
                  {formatTokenBalance(contractBalances.HEADSTART || '0')} HEADSTART
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Vault contract balance
                </p>
              </>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-300 mb-2">Contract HBAR Balance</h3>
            {tokenDataLoading ? (
              <div className="flex items-center justify-center h-16">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : tokenDataError ? (
              <div className="text-red-400 text-sm">
                Error loading data
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-white">
                  {formatHbarBalance(contractBalances.HBAR || '0')} HBAR
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Vault contract balance
                </p>
              </>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className={`text-xl font-medium text-white mb-4 ${vt323.className}`}>
              Recent Proposals
            </h3>
            <div className="space-y-4">
              {mockState.stakeholderVotingRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No recent proposals</p>
                  <p className="text-sm mt-1">New proposals will appear here</p>
                </div>
              ) : (
                mockState.stakeholderVotingRecords.slice(0, 5).map((record: { proposalId: string; vote: string; votingPower: number; timestamp: string }, index: number) => (
                  <div key={index} className="border border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-white">
                        Proposal {record.proposalId}
                      </h4>
                      <span className={`px-2 py-1 rounded text-xs ${
                        record.vote === 'approve' ? 'bg-green-900 text-green-300' :
                        record.vote === 'reject' ? 'bg-red-900 text-red-300' :
                        'bg-gray-900 text-gray-300'
                      }`}>
                        {record.vote}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Voting Power: {formatNumber(record.votingPower)} LYNX
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(record.timestamp)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className={`text-xl font-medium text-white mb-4 ${vt323.className}`}>
              Recent Messages
            </h3>
            <div className="space-y-4">
              {recentMessages.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No recent messages</p>
                  <p className="text-sm mt-1">HCS messages will appear here</p>
                </div>
              ) : (
                recentMessages.slice(0, 5).map((message, index) => (
                  <div key={index} className="border border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-white text-sm">
                        Sequence #{message.sequenceNumber}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {formatDate(new Date(parseInt(message.consensusTimestamp.split('.')[0]) * 1000).toISOString())}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 truncate">
                      {message.message.length > 100 
                        ? message.message.substring(0, 100) + '...'
                        : message.message
                      }
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className={`text-xl font-medium text-white mb-4 ${vt323.className}`}>
            System Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-300">Version</h4>
              <p className="text-white">{extractValue(metadata.version)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-300">Network</h4>
              <p className="text-white capitalize">{extractValue(metadata.networkState)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-300">Rebalancing Method</h4>
              <p className="text-white capitalize">Automatic</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-300">Emergency Override</h4>
              <p className="text-white">
                Disabled
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 