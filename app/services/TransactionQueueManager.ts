import { AccountId } from "@hashgraph/sdk";
import { DAppConnector } from "@hashgraph/hedera-wallet-connect";

export interface TransactionRequest {
  id: string;
  name: string;
  tokenName?: string;
  createTransaction: () => Promise<any>;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
  retryCount?: number;
  maxRetries?: number;
  delayMs?: number;
}

export interface QueueStats {
  totalTransactions: number;
  completedTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
}

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueuedTransaction extends TransactionRequest {
  status: TransactionStatus;
  error?: Error;
  result?: any;
  attempts: number;
  timestamp: number;
}

/**
 * Transaction Queue Manager for coordinating Hedera transactions
 * 
 * This class ensures transactions are executed sequentially with appropriate
 * delays between them to prevent race conditions with wallet popups.
 */
export class TransactionQueueManager {
  private queue: QueuedTransaction[] = [];
  private isProcessing: boolean = false;
  private connector: DAppConnector | null = null;
  private accountId: string | null = null;
  private defaultDelayMs: number = 500;
  private maxConcurrent: number = 1; // Currently hardcoded to 1 for sequential processing
  private defaultMaxRetries: number = 2;
  private processingPromise: Promise<void> | null = null;
  
  // Event callbacks
  private onTransactionStart?: (tx: QueuedTransaction) => void;
  private onTransactionComplete?: (tx: QueuedTransaction) => void;
  private onTransactionFail?: (tx: QueuedTransaction, error: Error) => void;
  private onQueueEmpty?: () => void;

  constructor(options?: {
    connector?: DAppConnector | null;
    accountId?: string | null;
    defaultDelayMs?: number;
    defaultMaxRetries?: number;
    onTransactionStart?: (tx: QueuedTransaction) => void;
    onTransactionComplete?: (tx: QueuedTransaction) => void;
    onTransactionFail?: (tx: QueuedTransaction, error: Error) => void;
    onQueueEmpty?: () => void;
  }) {
    if (options) {
      this.connector = options.connector || null;
      this.accountId = options.accountId || null;
      this.defaultDelayMs = options.defaultDelayMs || this.defaultDelayMs;
      this.defaultMaxRetries = options.defaultMaxRetries || this.defaultMaxRetries;
      this.onTransactionStart = options.onTransactionStart;
      this.onTransactionComplete = options.onTransactionComplete;
      this.onTransactionFail = options.onTransactionFail;
      this.onQueueEmpty = options.onQueueEmpty;
    }
  }

  /**
   * Update the wallet connector and account ID
   */
  public updateConnection(connector: DAppConnector | null, accountId: string | null): void {
    this.connector = connector;
    this.accountId = accountId;
  }

  /**
   * Add a transaction to the queue
   * @returns The transaction ID that can be used to check status
   */
  public enqueue(request: TransactionRequest): string {
    const queuedTx: QueuedTransaction = {
      ...request,
      status: 'pending',
      attempts: 0,
      timestamp: Date.now(),
      maxRetries: request.maxRetries ?? this.defaultMaxRetries,
      delayMs: request.delayMs ?? this.defaultDelayMs
    };

    this.queue.push(queuedTx);
    
    // Start processing if not already processing
    this.startProcessing();
    
    return request.id;
  }

  /**
   * Get current stats about the transaction queue
   */
  public getStats(): QueueStats {
    const total = this.queue.length;
    const completed = this.queue.filter(tx => tx.status === 'completed').length;
    const failed = this.queue.filter(tx => tx.status === 'failed').length;
    const pending = this.queue.filter(tx => tx.status === 'pending' || tx.status === 'processing').length;
    
    return {
      totalTransactions: total,
      completedTransactions: completed,
      failedTransactions: failed,
      pendingTransactions: pending
    };
  }

  /**
   * Get a transaction by ID
   */
  public getTransaction(id: string): QueuedTransaction | undefined {
    return this.queue.find(tx => tx.id === id);
  }

  /**
   * Clears completed and failed transactions from the queue
   */
  public cleanQueue(): void {
    this.queue = this.queue.filter(tx => 
      tx.status === 'pending' || tx.status === 'processing'
    );
  }

  /**
   * Check if the queue is currently processing
   */
  public isActive(): boolean {
    return this.isProcessing;
  }

  /**
   * Wait for all transactions to complete
   * @returns A promise that resolves when all transactions are processed
   */
  public async waitForCompletion(): Promise<void> {
    if (!this.isProcessing) {
      return Promise.resolve();
    }
    
    return this.processingPromise || Promise.resolve();
  }

  /**
   * Start processing the queue if not already processing
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    this.processingPromise = this.processQueue().finally(() => {
      this.isProcessing = false;
      this.processingPromise = null;
    });
  }

  /**
   * Process the queue of transactions
   */
  private async processQueue(): Promise<void> {
    // Continue processing while there are pending transactions
    while (this.queue.some(tx => tx.status === 'pending')) {
      // Get the next pending transaction
      const nextTx = this.queue.find(tx => tx.status === 'pending');
      if (!nextTx) break;
      
      // Mark the transaction as processing
      nextTx.status = 'processing';
      this.onTransactionStart?.(nextTx);
      
      try {
        // Process the transaction
        await this.processTransaction(nextTx);
        
        // After processing, the status might have been changed back to pending for retry
        // We need to check the current status
        const currentStatus = nextTx.status;
        if (currentStatus === 'pending') {
          // Transaction is queued for retry, continue to next iteration
          continue;
        }
        
        // Add a delay before processing the next transaction if one is specified
        // This helps prevent race conditions with wallet popups
        if (nextTx.delayMs && nextTx.delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, nextTx.delayMs));
        }
      } catch (error) {
        console.error(`Error processing transaction ${nextTx.id}:`, error);
        // We don't rethrow here as we want the queue to continue processing
      }
    }
    
    // Notify that the queue is empty if there are no more pending/processing txs
    if (!this.queue.some(tx => tx.status === 'pending' || tx.status === 'processing')) {
      this.onQueueEmpty?.();
    }
  }

  /**
   * Process a single transaction and handle retries
   */
  private async processTransaction(tx: QueuedTransaction): Promise<void> {
    console.log(`[TRACE] Processing transaction ${tx.id} (${tx.name}) - Attempt ${tx.attempts + 1}`);
    
    if (!this.connector) {
      const error = new Error('Wallet connector not initialized');
      console.error(`[TRACE] Failed to process transaction ${tx.id}: Wallet connector not initialized`);
      tx.status = 'failed';
      tx.error = error;
      this.onTransactionFail?.(tx, error);
      tx.onError?.(error);
      return;
    }

    if (!this.accountId) {
      const error = new Error('Account ID not available');
      console.error(`[TRACE] Failed to process transaction ${tx.id}: Account ID not available`);
      tx.status = 'failed';
      tx.error = error;
      this.onTransactionFail?.(tx, error);
      tx.onError?.(error);
      return;
    }
    
    console.log(`[TRACE] Transaction ${tx.id} prerequisites OK, executing transaction`);
    
    try {
      // Increment attempt counter
      tx.attempts++;
      
      // Execute the transaction
      console.log(`[TRACE] Calling createTransaction for ${tx.id}`);
      const result = await tx.createTransaction();
      console.log(`[TRACE] Transaction ${tx.id} execution completed:`, result);
      
      // Mark as completed if successful
      tx.status = 'completed';
      tx.result = result;
      console.log(`[TRACE] Transaction ${tx.id} marked as completed`);
      
      this.onTransactionComplete?.(tx);
      
      if (tx.onSuccess) {
        console.log(`[TRACE] Calling onSuccess callback for ${tx.id}`);
        tx.onSuccess?.(result);
      }
    } catch (error) {
      console.error(`[TRACE] Error executing transaction ${tx.id}:`, error);
      
      const typedError = error instanceof Error ? error : new Error(String(error));
      
      // Maximum retries is defaultMaxRetries (usually set to 2) if not specified
      const maxRetries = tx.maxRetries ?? this.defaultMaxRetries;
      
      // Check if we should retry (attempts starts at 1, so we compare to maxRetries + 1)
      if (tx.attempts <= maxRetries) {
        console.log(`[TRACE] Retrying transaction ${tx.id} (${tx.attempts}/${maxRetries})`);
        tx.status = 'pending';
        
        // Add exponential backoff for retries
        if (tx.delayMs) {
          tx.delayMs = Math.floor(tx.delayMs * 1.5);
          console.log(`[TRACE] Set backoff delay for ${tx.id} to ${tx.delayMs}ms`);
        } else {
          tx.delayMs = this.defaultDelayMs;
          console.log(`[TRACE] Set default delay for ${tx.id} to ${tx.delayMs}ms`);
        }
      } else {
        // Max retries exceeded
        console.error(`[TRACE] Transaction ${tx.id} failed after ${tx.attempts} attempts, will not retry`);
        tx.status = 'failed';
        tx.error = typedError;
        
        this.onTransactionFail?.(tx, typedError);
        
        if (tx.onError) {
          console.log(`[TRACE] Calling onError callback for ${tx.id}`);
          tx.onError?.(error);
        }
      }
    }
  }
} 