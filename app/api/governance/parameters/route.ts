import { NextResponse } from 'next/server';
import { createDefaultDaoParameters } from '../../../types';

interface MirrorNodeMessage {
  consensus_timestamp: string;
  message: string;
  sequence_number: number;
  running_hash: string;
  topic_id: string;
}

interface MirrorNodeResponse {
  messages: MirrorNodeMessage[];
}

// New snapshot schema interface
interface TokenRatioSnapshot {
  p: string;
  op: string;
  t_id: string;
  metadata: string;
  m: string;
  data: {
    snapshot_id: string;
    snapshot_type: string;
    governance_session: string;
    token_weights: {
      HBAR: number;
      WBTC: number;
      SAUCE: number;
      USDC: number;
      JAM: number;
      HEADSTART: number;
    };
    timestamp: string;
    created_by: string;
    hash: string;
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID || '0.0.6110234';

    console.log('API: Fetching DAO parameters from topic:', governanceTopicId);

    // Get mirror node base URL
    const mirrorNodeUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    // Fetch messages from the governance topic
    const url = `${mirrorNodeUrl}/api/v1/topics/${governanceTopicId}/messages?order=desc&limit=10`;
    console.log('API: Fetching from URL:', url);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('API: Mirror node request failed:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch from mirror node', details: `${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data: MirrorNodeResponse = await response.json();
    console.log('API: Retrieved messages:', {
      messageCount: data.messages?.length || 0,
      topicId: governanceTopicId
    });

    if (!data.messages || data.messages.length === 0) {
      console.log('API: No messages found in topic');
      return NextResponse.json(
        { error: 'No messages found in governance topic' },
        { status: 404 }
      );
    }

    // Process messages to find the most recent token ratio snapshot
    for (const message of data.messages) {
      try {
        // Decode base64 message
        const messageData = Buffer.from(message.message, 'base64').toString('utf-8');
        console.log('API: Analyzing message:', {
          sequence: message.sequence_number,
          timestamp: message.consensus_timestamp,
          messagePreview: messageData.substring(0, 100) + '...'
        });

        const parsed = JSON.parse(messageData);

        // Check if this is the new token ratio snapshot format
        if (parsed.p === 'hcs-2' && parsed.op === 'register' && parsed.data?.snapshot_type === 'token_ratios') {
          console.log('API: Found token ratio snapshot:', {
            snapshotId: parsed.data.snapshot_id,
            governanceSession: parsed.data.governance_session,
            tokenWeights: parsed.data.token_weights
          });

          // Create a simplified parameters object with just the token weights
          const tokenWeights = parsed.data.token_weights;
          
          // Create a minimal parameters structure that matches the expected format
          const parameters = {
            treasury: {
              weights: {
                HBAR: tokenWeights.HBAR,
                WBTC: tokenWeights.WBTC,
                SAUCE: tokenWeights.SAUCE,
                USDC: tokenWeights.USDC,
                JAM: tokenWeights.JAM,
                HEADSTART: tokenWeights.HEADSTART
              },
              // Keep default values for other treasury parameters
              maxSlippage: {
                HBAR: 1.0,
                WBTC: 2.0,
                SAUCE: 3.0,
                USDC: 0.5,
                JAM: 3.0,
                HEADSTART: 5.0
              },
              maxSwapSize: {
                HBAR: 1000000,
                WBTC: 500000,
                SAUCE: 250000,
                USDC: 1000000,
                JAM: 100000,
                HEADSTART: 50000
              }
            },
            // Keep default values for other parameter sections
            rebalancing: {
              frequencyHours: 24,
              thresholds: {
                normal: 10,
                emergency: 20
              },
              cooldownPeriods: {
                normal: 48,
                emergency: 12
              }
            },
            fees: {
              mintingFee: 0.3,
              burningFee: 0.3,
              operationalFee: 0.1
            },
            governance: {
              quorumPercentage: 20,
              votingPeriodHours: 72,
              proposalThreshold: 1000
            },
            metadata: {
              version: "1.0.0",
              lastUpdated: parsed.data.timestamp,
              updatedBy: parsed.data.created_by,
              networkState: network as 'mainnet' | 'testnet' | 'previewnet',
              topicId: governanceTopicId,
              sequenceNumber: message.sequence_number
            }
          };

          return NextResponse.json({
            parameters,
            metadata: {
              timestamp: parsed.data.timestamp,
              sequenceNumber: message.sequence_number,
              version: "1.0.0",
              sourceTopicId: governanceTopicId,
              snapshotId: parsed.data.snapshot_id,
              governanceSession: parsed.data.governance_session,
              hash: parsed.data.hash
            }
          });
        }

        // Legacy support for old format (keep for backward compatibility)
        if (parsed.parameters || parsed.rebalancing || parsed.treasury) {
          console.log('API: Found legacy DAO parameters format');
          
          return NextResponse.json({
            parameters: parsed.parameters || parsed,
            metadata: {
              timestamp: message.consensus_timestamp,
              sequenceNumber: message.sequence_number,
              version: parsed.metadata?.version || '1.0.0',
              sourceTopicId: governanceTopicId
            }
          });
        }

      } catch (parseError) {
        console.log('API: Could not parse message as JSON:', {
          sequence: message.sequence_number,
          error: parseError instanceof Error ? parseError.message : 'Unknown error'
        });
        continue;
      }
    }

    console.log('API: No token ratio snapshots found, returning defaults');
    
    // Return default parameters if none found
    return NextResponse.json({
      parameters: createDefaultDaoParameters(),
      metadata: {
        timestamp: new Date().toISOString(),
        sequenceNumber: 0,
        version: '1.0.0-default',
        sourceTopicId: 'default'
      }
    });

  } catch (error) {
    console.error('API: Error fetching governance parameters:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 