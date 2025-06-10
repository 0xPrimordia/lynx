import { Client, PrivateKey, TopicId, TopicMessageSubmitTransaction } from '@hashgraph/sdk';
import { DaoParameters } from '../types';

export interface HCSMessage {
  consensusTimestamp: string;
  message: string;
  sequenceNumber: number;
  runningHash: string;
  topicId: string;
}

export interface DaoParameterSnapshot {
  timestamp: string;
  parameters: DaoParameters;
  version: string;
  signature?: string;
}

export class HCSService {
  private client: Client;
  private isInitialized = false;
  private governanceTopicId: string;
  private onParametersUpdated?: (parameters: DaoParameters) => void;
  private operatorId: string | undefined;
  private operatorKey: string | undefined;
  private network: 'testnet' | 'mainnet' | 'previewnet';

  constructor(
    operatorId?: string,
    operatorKey?: string,
    network: 'testnet' | 'mainnet' | 'previewnet' = 'testnet',
    governanceTopicId: string = '0.0.6110234'
  ) {
    this.governanceTopicId = governanceTopicId;
    this.operatorId = operatorId;
    this.operatorKey = operatorKey;
    this.network = network;

    try {
      // Initialize Hedera client with proper mirror node configuration
      if (network === 'testnet') {
        this.client = Client.forTestnet();
      } else if (network === 'mainnet') {
        this.client = Client.forMainnet();
      } else {
        this.client = Client.forPreviewnet();
      }

      // Set operator if provided (optional for read-only operations)
      if (operatorId && operatorKey) {
        this.client.setOperator(operatorId, PrivateKey.fromString(operatorKey));
      }

      // Ensure the client is properly configured
      console.log(`HCS Service configured for ${network} network`);
    } catch (error) {
      console.error('Failed to initialize Hedera client:', error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing HCS Service...');
      this.isInitialized = true;
      console.log('HCS Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize HCS Service:', error);
      throw error;
    }
  }

  async subscribeToGovernanceTopic(
    onMessage: (message: HCSMessage) => void,
    onParametersUpdate?: (parameters: DaoParameters) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      console.log('HCS Service not initialized, initializing now...');
      await this.initialize();
    }

    console.log('Starting subscription to governance topic...');
    this.onParametersUpdated = onParametersUpdate;

    try {
      console.log('Attempting to fetch latest parameters via API...');
      // Fetch the latest DAO parameters from our API route
      const latestParameters = await this.fetchLatestParameters();
      
      if (latestParameters && onParametersUpdate) {
        console.log('Successfully fetched parameters from API, calling onParametersUpdate...');
        onParametersUpdate(latestParameters);
        console.log('Loaded latest DAO parameters from governance topic');
      } else {
        console.log('No parameters found in topic, using defaults');
      }

    } catch (error) {
      console.error('Failed to fetch governance parameters:', error);
      console.log('Operating with default parameters');
    }
  }

  private async fetchLatestParameters(): Promise<DaoParameters | null> {
    try {
      console.log('Fetching parameters from API route...');
      
      const response = await fetch('/api/governance/parameters');
      
      if (!response.ok) {
        console.error('API response not ok:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      
      if (data.error) {
        console.error('API returned error:', data.error);
        return null;
      }

      console.log('Successfully fetched parameters from API:', {
        timestamp: data.metadata?.timestamp,
        version: data.metadata?.version,
        sequenceNumber: data.metadata?.sequenceNumber
      });

      // Persist the snapshot
      if (data.parameters && data.metadata) {
        this.persistParameters({
          timestamp: data.metadata.timestamp,
          parameters: data.parameters,
          version: data.metadata.version
        });
      }

      return data.parameters;

    } catch (error) {
      console.error('Error fetching parameters from API:', error);
      return null;
    }
  }

  private persistParameters(snapshot: DaoParameterSnapshot): void {
    try {
      if (typeof window !== 'undefined') {
        // Store the complete snapshot
        localStorage.setItem('lynx-dao-parameters', JSON.stringify(snapshot));
        localStorage.setItem('lynx-dao-parameters-timestamp', snapshot.timestamp);
        
        console.log('DAO parameters persisted to localStorage');
      }
    } catch (error) {
      console.error('Failed to persist parameters:', error);
    }
  }

  getPersistedParameters(): DaoParameters | null {
    try {
      if (typeof window !== 'undefined') {
        const storedSnapshot = localStorage.getItem('lynx-dao-parameters');
        if (storedSnapshot) {
          const snapshot: DaoParameterSnapshot = JSON.parse(storedSnapshot);
          return snapshot.parameters;
        }
      }
    } catch (error) {
      console.error('Failed to retrieve persisted parameters:', error);
    }
    return null;
  }

  getParametersTimestamp(): string | null {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('lynx-dao-parameters-timestamp');
      }
    } catch (error) {
      console.error('Failed to retrieve parameters timestamp:', error);
    }
    return null;
  }

  async unsubscribe(): Promise<void> {
    // No subscription to unsubscribe from since we just fetch once
    console.log('No active subscription to unsubscribe from');
  }

  async sendMessage(message: string, targetTopicId?: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.client.operatorAccountId || !this.client._operator) {
      throw new Error('Operator account required for sending messages');
    }

    try {
      const topicId = targetTopicId || this.governanceTopicId;
      const messageBytes = Buffer.from(message, 'utf-8');
      
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(messageBytes);

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return response.transactionId.toString();
    } catch (error) {
      console.error('Failed to send message to topic:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
let hcsServiceInstance: HCSService | null = null;

export function getHCSService(): HCSService {
  if (!hcsServiceInstance) {
    // Simple initialization without credentials for client-side
    const network = (process.env.NEXT_PUBLIC_HEDERA_NETWORK as 'testnet' | 'mainnet' | 'previewnet') || 'testnet';
    const governanceTopicId = process.env.NEXT_PUBLIC_GOVERNANCE_TOPIC_ID || '0.0.6110234';
    
    console.log('Creating HCS Service for client-side use:', {
      network,
      governanceTopicId
    });
    
    hcsServiceInstance = new HCSService(undefined, undefined, network, governanceTopicId);
  }
  return hcsServiceInstance;
} 