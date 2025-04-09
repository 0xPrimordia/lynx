import { TransactionQueueManager, QueuedTransaction } from '../../app/services/TransactionQueueManager';
import { DAppConnector } from '@hashgraph/hedera-wallet-connect';

// Mock the DAppConnector
jest.mock('@hashgraph/hedera-wallet-connect', () => ({
  DAppConnector: jest.fn()
}));

describe('TransactionQueueManager', () => {
  let queueManager: TransactionQueueManager;
  const mockConnector = {} as DAppConnector;
  const mockAccountId = '0.0.12345';
  
  beforeEach(() => {
    jest.clearAllMocks();
    queueManager = new TransactionQueueManager({
      connector: mockConnector,
      accountId: mockAccountId,
      defaultDelayMs: 100,
      defaultMaxRetries: 1
    });
  });
  
  test('should initialize with correct default values', () => {
    expect(queueManager.getStats()).toEqual({
      totalTransactions: 0,
      completedTransactions: 0,
      failedTransactions: 0,
      pendingTransactions: 0
    });
    expect(queueManager.isActive()).toBe(false);
  });
  
  test('should enqueue a transaction and return its ID', () => {
    const txId = 'test-transaction-1';
    const mockCreateTransaction = jest.fn().mockResolvedValue({ status: 'success' });
    
    const id = queueManager.enqueue({
      id: txId,
      name: 'Test Transaction',
      createTransaction: mockCreateTransaction
    });
    
    expect(id).toBe(txId);
    expect(queueManager.getStats().totalTransactions).toBe(1);
    expect(queueManager.getStats().pendingTransactions).toBe(1);
    expect(queueManager.isActive()).toBe(true);
  });
  
  test('should clean the queue properly', () => {
    // Add some transactions with different statuses
    const completedTx = {
      id: 'completed-tx',
      name: 'Completed',
      status: 'completed',
      attempts: 1,
      timestamp: Date.now(),
      createTransaction: jest.fn()
    } as QueuedTransaction;
    
    const failedTx = {
      id: 'failed-tx',
      name: 'Failed',
      status: 'failed',
      attempts: 3,
      timestamp: Date.now(),
      createTransaction: jest.fn()
    } as QueuedTransaction;
    
    const pendingTx = {
      id: 'pending-tx',
      name: 'Pending',
      status: 'pending',
      attempts: 0,
      timestamp: Date.now(),
      createTransaction: jest.fn()
    } as QueuedTransaction;
    
    const processingTx = {
      id: 'processing-tx',
      name: 'Processing',
      status: 'processing',
      attempts: 1,
      timestamp: Date.now(),
      createTransaction: jest.fn()
    } as QueuedTransaction;
    
    // Manually add transactions to the queue
    (queueManager as any).queue = [completedTx, failedTx, pendingTx, processingTx];
    
    // Verify initial state
    expect(queueManager.getStats().totalTransactions).toBe(4);
    
    // Clean the queue
    queueManager.cleanQueue();
    
    // Verify that only pending and processing transactions remain
    expect(queueManager.getStats().totalTransactions).toBe(2);
    expect(queueManager.getTransaction('completed-tx')).toBeUndefined();
    expect(queueManager.getTransaction('failed-tx')).toBeUndefined();
    expect(queueManager.getTransaction('pending-tx')).toBeDefined();
    expect(queueManager.getTransaction('processing-tx')).toBeDefined();
  });
  
  test('should handle wallet connector not initialized', async () => {
    // Create a queue manager with no connector
    const noConnectorManager = new TransactionQueueManager({
      accountId: mockAccountId
    });
    
    const mockCreateTx = jest.fn();
    const onError = jest.fn();
    
    // Mock the processTransaction method to execute immediately
    const processTransactionSpy = jest.spyOn(
      noConnectorManager as any, 
      'processTransaction'
    );
    
    noConnectorManager.enqueue({
      id: 'no-connector-tx',
      name: 'No Connector Transaction',
      createTransaction: mockCreateTx,
      onError
    });
    
    // Manually call processTransaction since we're not waiting for timers
    await (noConnectorManager as any).processTransaction(
      (noConnectorManager as any).queue[0]
    );
    
    // Verify the transaction failed with the correct error
    const txStatus = noConnectorManager.getTransaction('no-connector-tx');
    expect(txStatus?.status).toBe('failed');
    expect(txStatus?.error?.message).toBe('Wallet connector not initialized');
    
    // onError should be called with the error
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0].message).toBe('Wallet connector not initialized');
  });
  
  test('should update connection details correctly', () => {
    const newConnector = {} as DAppConnector;
    const newAccountId = '0.0.67890';
    
    queueManager.updateConnection(newConnector, newAccountId);
    
    // Create a transaction to test the connection
    const mockCreateTx = jest.fn().mockResolvedValue({ status: 'success' });
    queueManager.enqueue({
      id: 'test-connection-tx',
      name: 'Test Connection',
      createTransaction: mockCreateTx
    });
    
    // Verify the queue is active
    expect(queueManager.isActive()).toBe(true);
  });
  
  // Test just the core functionality without the async complexity
  test('should process a transaction successfully', async () => {
    const mockCreateTx = jest.fn().mockResolvedValue({ status: 'success', txId: 'success-id' });
    const onSuccess = jest.fn();
    
    // Create a transaction
    const tx: QueuedTransaction = {
      id: 'direct-tx',
      name: 'Direct Test',
      status: 'pending',
      attempts: 0,
      timestamp: Date.now(),
      createTransaction: mockCreateTx,
      onSuccess
    };
    
    // Directly call the private method to process the transaction
    await (queueManager as any).processTransaction(tx);
    
    // Verify the transaction was processed correctly
    expect(tx.status).toBe('completed');
    expect(tx.attempts).toBe(1);
    expect(mockCreateTx).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ status: 'success', txId: 'success-id' });
  });
  
  test('should handle transaction retry correctly', async () => {
    let attempts = 0;
    const mockCreateTx = jest.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('Temporary failure');
      }
      return { status: 'success', txId: 'retry-success' };
    });
    
    const onSuccess = jest.fn();
    const onError = jest.fn();
    
    // Create a transaction with retry capability
    const tx: QueuedTransaction = {
      id: 'retry-tx',
      name: 'Retry Test',
      status: 'pending',
      attempts: 0,
      timestamp: Date.now(),
      createTransaction: mockCreateTx,
      onSuccess,
      onError,
      maxRetries: 1
    };
    
    // First attempt (will fail)
    await (queueManager as any).processTransaction(tx);
    
    // Verify transaction status after first attempt
    expect(tx.status).toBe('pending'); // Should be set back to pending for retry
    expect(tx.attempts).toBe(1);
    expect(mockCreateTx).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    
    // Second attempt (should succeed)
    await (queueManager as any).processTransaction(tx);
    
    // Verify transaction status after second attempt
    expect(tx.status).toBe('completed');
    expect(tx.attempts).toBe(2);
    expect(mockCreateTx).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith({ status: 'success', txId: 'retry-success' });
    expect(onError).not.toHaveBeenCalled();
  });
  
  test('should handle max retries exhaustion', async () => {
    const persistentError = new Error('Persistent failure');
    const mockCreateTx = jest.fn().mockRejectedValue(persistentError);
    const onSuccess = jest.fn();
    const onError = jest.fn();
    
    // Create a transaction with retry capability
    const tx: QueuedTransaction = {
      id: 'max-retry-tx',
      name: 'Max Retry Test',
      status: 'pending',
      attempts: 0,
      timestamp: Date.now(),
      createTransaction: mockCreateTx,
      onSuccess,
      onError,
      maxRetries: 2
    };
    
    // First attempt (will fail)
    await (queueManager as any).processTransaction(tx);
    
    // Verify transaction status after first attempt
    expect(tx.status).toBe('pending'); // Should be set back to pending for retry
    expect(tx.attempts).toBe(1);
    
    // Second attempt (will fail)
    await (queueManager as any).processTransaction(tx);
    
    // Verify transaction status after second attempt
    expect(tx.status).toBe('pending'); // Should be set back to pending for retry
    expect(tx.attempts).toBe(2);
    
    // Third attempt (will fail and exhaust retries)
    await (queueManager as any).processTransaction(tx);
    
    // Verify transaction status after max retries
    expect(tx.status).toBe('failed');
    expect(tx.attempts).toBe(3);
    expect(mockCreateTx).toHaveBeenCalledTimes(3);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(persistentError);
    expect(tx.error).toBe(persistentError);
  });
}); 