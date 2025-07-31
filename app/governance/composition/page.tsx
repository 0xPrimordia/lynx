'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { VT323 } from "next/font/google";
import { useDaoParameters } from '../../providers/DaoParametersProvider';
import { LYNX_TOKENS, TOKEN_INFO, LynxTokenSymbol, getParameterValue } from '../../types';
import { useWallet } from '../../hooks/useWallet';
import { 
  TopicMessageSubmitTransaction, 
  TransactionId,
  Client,
  AccountId
} from '@hashgraph/sdk';
import { transactionToBase64String } from '@hashgraph/hedera-wallet-connect';
import { toast } from 'sonner';

const vt323 = VT323({ weight: "400", subsets: ["latin"] });

interface TokenComposition {
  symbol: LynxTokenSymbol;
  name: string;
  sector: string;
  allocation: number;
  maxSlippage: number;
  maxSwapSize: number;
}

interface MultiRatioGovernanceVote {
  type: 'MULTI_RATIO_VOTE';
  ratioChanges: Array<{
    token: string;
    newRatio: number;
  }>;
  voterAccountId: string;
  votingPower: number;
  timestamp: Date;
  txId?: string;
  reason?: string;
}

export default function CompositionPage() {
  const { parameters, isLoading, error } = useDaoParameters();
  
  // Check if snapshot failed to load (all weights are 0)
  const isSnapshotFailed = parameters && 
    parameters.treasury?.weights && 
    Object.values(parameters.treasury.weights).every(weight => 
      getParameterValue(weight) === 0
    );
  const { account, isConnected, connector: dAppConnector } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showVoteButton, setShowVoteButton] = useState<boolean>(false);
  const [proposedChanges, setProposedChanges] = useState<{ [key: string]: number }>({});
  const [votingPower, setVotingPower] = useState<number>(0);

  // Get governance topic ID from environment
  const governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID || '0.0.6110234';

  // Map token symbols to their icon URLs
  const getTokenIconUrl = (symbol: string): string => {
    const tokenMap: Record<string, string> = {
      'HBAR': 'https://d1grbdlekdv9wn.cloudfront.net/icons/tokens/0.0.15058.png',
      'WBTC': '/images/tokens/fallback.png', // Use fallback
      'SAUCE': 'https://d1grbdlekdv9wn.cloudfront.net/icons/tokens/0.0.1188.png',
      'USDC': '/images/tokens/fallback.png', // Use fallback
      'JAM': 'https://assets.coingecko.com/coins/images/28731/thumb/jam.png', // Using CoinGecko as backup
      'HEADSTART': '/images/tokens/default.png' // Will fall back to text circle
    };
    
    return tokenMap[symbol] || '/images/tokens/default.png';
  };

  const generateComposition = (): TokenComposition[] => {
    if (!parameters) return [];

    return LYNX_TOKENS.map(token => ({
      symbol: token,
      name: TOKEN_INFO[token].name,
      sector: TOKEN_INFO[token].sector,
      allocation: getParameterValue(parameters.treasury.weights[token]),
      maxSlippage: getParameterValue(parameters.treasury.maxSlippage[token]),
      maxSwapSize: getParameterValue(parameters.treasury.maxSwapSize[token])
    }));
  };



  const handleAllocationChange = (symbol: LynxTokenSymbol, newAllocation: number) => {
    // Disable changes if snapshot failed to load
    if (isSnapshotFailed) {
      return;
    }
    
    setProposedChanges(prev => ({
      ...prev,
      [symbol]: newAllocation
    }));
    setShowVoteButton(true);
  };

  // Calculate total allocation percentage
  const calculateTotalAllocation = (): number => {
    if (!parameters) return 0;
    return LYNX_TOKENS.reduce((total, token) => {
      const allocation = proposedChanges[token] ?? getParameterValue(parameters.treasury.weights[token]);
      return total + allocation;
    }, 0);
  };

  const totalAllocation = calculateTotalAllocation();
  const allocationDifference = totalAllocation - 100;

  // Mock function to get LYNX token balance for voting power
  // In a real implementation, this would query the actual token balance
  const fetchVotingPower = useCallback(async (): Promise<number> => {
    if (!isConnected || !account?.accountId) {
      return 0;
    }
    
    try {
      // Mock voting power calculation - in reality this would query the user's LYNX balance
      // For testing quorum triggers, using a high value (25% of total supply to trigger quorum)
      const mockVotingPower = 250000; // 250K LYNX for testing quorum
      return mockVotingPower;
    } catch (error) {
      console.error('Error fetching voting power:', error);
      return 0;
    }
  }, [isConnected, account?.accountId]);

  // Fetch voting power when wallet connects
  useEffect(() => {
    if (isConnected && account?.accountId) {
      fetchVotingPower().then(setVotingPower);
    } else {
      setVotingPower(0);
    }
  }, [isConnected, account?.accountId, fetchVotingPower]);

  const handleVoteSubmit = async () => {
    if (!isConnected || !account?.accountId) {
      toast.error('Please connect your wallet to submit governance votes');
      return;
    }

    if (Object.keys(proposedChanges).length === 0) {
      toast.error('No changes to submit');
      return;
    }

    try {
      setIsSubmitting(true);
      toast.loading('Submitting governance votes to Hedera Consensus Service...');

      // Create a single multi-ratio vote containing all changes
      const multiRatioVote: MultiRatioGovernanceVote = {
        type: 'MULTI_RATIO_VOTE',
        ratioChanges: Object.entries(proposedChanges).map(([symbol, newValue]) => ({
          token: symbol,
          newRatio: newValue
        })),
        voterAccountId: String(account.accountId),
        votingPower: votingPower,
        timestamp: new Date(),
        reason: `Proposed ratio changes for ${Object.keys(proposedChanges).length} tokens`
      };

      console.log('Submitting multi-ratio vote:', multiRatioVote);
      
      // Create client for testnet
      const client = Client.forTestnet();
      
      // Create single topic message submission transaction
      const voteMessage = JSON.stringify(multiRatioVote, null, 2);
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(governanceTopicId)
        .setMessage(voteMessage)
        .setTransactionId(TransactionId.generate(AccountId.fromString(String(account.accountId))))
        .freezeWith(client);

      // Convert to base64 for wallet submission
      const txBase64 = transactionToBase64String(transaction);
      
      // Submit via wallet (single transaction)
      if (!dAppConnector) {
        throw new Error('Wallet connector not available');
      }

      const response = await dAppConnector.signAndExecuteTransaction({
        signerAccountId: String(account.accountId),
        transactionList: txBase64
      });

      const txId = String(response?.id) || `topic-${governanceTopicId}-${Date.now()}`;

      toast.dismiss();
      
      if (txId) {
        toast.success(
          `Successfully submitted multi-ratio governance vote to HCS topic ${governanceTopicId}! ` +
          `Transaction ID: ${txId}`
        );
        
        // Reset the proposed changes
        setShowVoteButton(false);
        setProposedChanges({});
        
        // Show summary
        console.log('Multi-ratio governance vote submitted:', {
          voterAccountId: String(account.accountId),
          votingPower: votingPower,
          changes: proposedChanges,
          transactionId: txId,
          topicId: governanceTopicId,
          message: 'Multi-ratio vote submitted via Hedera Consensus Service'
        });
      } else {
        toast.error('Failed to submit governance vote');
      }

    } catch (error: unknown) {
      console.error('Error submitting governance votes:', error);
      toast.dismiss();
      toast.error(`Failed to submit governance votes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const TokenImage = ({ symbol, size = 80 }: { symbol: string; size?: number }) => {
    const [imageError, setImageError] = useState(false);
    
    if (imageError) {
      return (
        <div 
          className="rounded-full bg-gray-700 flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          <span className="text-white font-medium text-sm">
            {symbol.substring(0, 2)}
          </span>
        </div>
      );
    }
    
    return (
      <Image
        src={getTokenIconUrl(symbol)}
        alt={symbol}
        width={size}
        height={size}
        className="object-contain"
        onError={() => setImageError(true)}
      />
    );
  };

  const renderTokenCard = (token: TokenComposition, isEditable: boolean = false) => {
    const currentAllocation = proposedChanges[token.symbol] ?? token.allocation;
    const hasChanged = proposedChanges[token.symbol] !== undefined;
    const originalAllocation = token.allocation;
    
    return (
              <div 
          key={token.symbol} 
          className="bg-gray-800 rounded-lg p-6 pb-4 mb-6 flex flex-col items-center justify-between w-[200px] h-[380px]"
        >
        <div className="flex flex-col items-center">
          <div className="rounded-full p-2 mb-2">
            <TokenImage symbol={token.symbol} />
          </div>
          <div className="text-center">
            <div className="text-white font-medium text-lg">{token.symbol}</div>
            <div className="text-sm text-gray-400 mt-1">{token.name}</div>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">{token.sector}</div>
        </div>
        
        <div className="w-full space-y-3">
          <div className="text-center">
            {isEditable ? (
              <div>
                <input
                  type="range"
                  min="5"
                  max="40"
                  value={currentAllocation}
                  onChange={(e) => handleAllocationChange(token.symbol, parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="text-xl font-bold text-white mt-2">
                  {currentAllocation}%
                  {hasChanged && (
                    <span className="text-sm text-gray-400 ml-2">
                      (was {originalAllocation}%)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xl font-bold text-white">{token.allocation}%</div>
            )}
            <div className="text-xs text-gray-400">Allocation</div>
          </div>
          
                      <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-gray-400">Max Slip</div>
                <div className="text-white">{token.maxSlippage}%</div>
              </div>
            <div>
              <div className="text-gray-400">Max Swap</div>
              <div className="text-white">${(token.maxSwapSize / 1000)}K</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mx-auto my-8 max-w-2xl text-white">
        {error}
      </div>
    );
  }

  if (!parameters) {
    return (
      <div className="text-center py-12">
        <h2 className={`text-2xl mb-4 ${vt323.className}`}>Loading Composition Data</h2>
        <p className="text-gray-400">Fetching treasury parameters...</p>
      </div>
    );
  }

  const currentComposition = generateComposition();

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold text-white mb-2 ${vt323.className}`}>
            Treasury Composition
          </h1>
          <p className="text-gray-400">
            Monitor and adjust token allocation weights for the Lynx treasury
          </p>
        </div>

        {/* Snapshot Failure Warning */}
        {isSnapshotFailed && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium text-red-400 mb-2">⚠️ Snapshot Loading Failed</h3>
            <p className="text-red-300">
              Unable to load governance snapshot data. Voting is disabled until snapshot data is available.
            </p>
            <div className="mt-3 text-sm text-red-200">
              Check that the snapshot topic contains valid token ratio data.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          {/* Allocation Validation - Always visible to prevent layout jump */}
          <div className={`p-3 rounded-lg border text-center transition-all duration-200 ${
            showVoteButton 
              ? Math.abs(allocationDifference) < 0.01 
                ? 'bg-green-900/10 border-green-800/30 text-green-400' 
                : 'bg-yellow-900/10 border-yellow-800/30 text-yellow-400'
              : 'bg-gray-900/10 border-gray-800/30 text-gray-400'
          }`}>
            <div className="text-sm">
              Total Allocation: {totalAllocation.toFixed(1)}%
              {showVoteButton && Math.abs(allocationDifference) >= 0.01 && (
                <span className="ml-2">
                  ({allocationDifference > 0 
                    ? `+${allocationDifference.toFixed(1)}%` 
                    : `${allocationDifference.toFixed(1)}%`
                  })
                </span>
              )}
            </div>
          </div>

          {/* Current Composition */}
          <div className="mb-8">
                      <div className="flex flex-wrap gap-4 justify-center">
            {currentComposition.map(token => (
              renderTokenCard(token, !isSnapshotFailed)
            ))}
          </div>
            
            {showVoteButton && !isSnapshotFailed && (
              <div className="flex justify-center mt-6">
                <button 
                  onClick={handleVoteSubmit}
                  disabled={isSubmitting || !isConnected || Math.abs(allocationDifference) >= 0.01}
                  className={`border border-white text-white py-3 px-8 rounded-md text-sm font-medium hover:bg-white/10 transition-colors ${
                    (isSubmitting || !isConnected || Math.abs(allocationDifference) >= 0.01) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting 
                    ? 'Submitting to HCS...' 
                    : !isConnected 
                    ? 'Connect Wallet to Vote' 
                    : 'Submit Changes for Governance Vote'
                  }
                </button>
              </div>
            )}
          </div>
          
          {/* Wallet & Voting Status */}
          {isConnected && account && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h3 className={`text-lg font-medium text-white mb-4 ${vt323.className}`}>
                Voting Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-400">Connected Account</div>
                  <div className="text-lg text-white font-mono">{account.accountId}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Voting Power</div>
                  <div className="text-xl text-white">{votingPower.toLocaleString()} LYNX</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Network</div>
                  <div className="text-lg text-white capitalize">{account.network}</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400">Governance Topic</div>
                <div className="text-sm text-white font-mono">{governanceTopicId}</div>
              </div>
            </div>
          )}

          {!isConnected && (
            <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-medium text-yellow-400 mb-2">Connect Wallet to Vote</h3>
              <p className="text-yellow-300">
                Connect your wallet to submit governance votes for parameter changes.
              </p>
              <div className="mt-3 text-sm text-yellow-200">
                Votes will be submitted to HCS topic: <code className="bg-yellow-800/30 px-1 rounded">{governanceTopicId}</code>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className={`text-lg font-medium text-white mb-4 ${vt323.className}`}>
              Allocation Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-400">Total Tokens</div>
                <div className="text-xl text-white">{LYNX_TOKENS.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Largest Allocation</div>
                <div className="text-xl text-white">
                  {Math.max(...currentComposition.map(t => proposedChanges[t.symbol] ?? t.allocation))}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Smallest Allocation</div>
                <div className="text-xl text-white">
                  {Math.min(...currentComposition.map(t => proposedChanges[t.symbol] ?? t.allocation))}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Total Allocation</div>
                <div className="text-xl text-white">
                  {currentComposition.reduce((sum, t) => sum + (proposedChanges[t.symbol] ?? t.allocation), 0)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}