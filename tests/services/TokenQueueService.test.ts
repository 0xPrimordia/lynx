import { TokenQueueService, TokenApprovalParams, MintParams } from '../../app/services/TokenQueueService';
import { TransactionQueueManager, QueuedTransaction } from '../../app/services/TransactionQueueManager';
import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { v4 as uuidv4 } from 'uuid';
import { TransactionService } from '../../app/services/transactionService';

// Mock TransactionQueueManager
jest.mock('../../app/services/TransactionQueueManager', () => {
  return {
    TransactionQueueManager: jest.fn().mockImplementation(() => ({
      enqueue: jest.fn().mockImplementation(({ id }) => id),
      getTransaction: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        totalTransactions: 3,
        completedTransactions: 1,
        failedTransactions: 0,
        pendingTransactions: 2
      }),
      updateConnection: jest.fn()
    }))
  };
});

// Mock TransactionService
jest.mock('../../app/services/transactionService', () => {
  return {
    TransactionService: jest.fn().mockImplementation(() => ({
      approveToken: jest.fn().mockResolvedValue({ status: 'success', txId: 'mock-approval-tx-id' }),
      mintLynx: jest.fn().mockResolvedValue({ status: 'success', txId: 'mock-mint-tx-id' }),
      updateConnection: jest.fn()
    }))
  };
});

describe('TokenQueueService', () => {
  let tokenQueueService: TokenQueueService;
  let mockQueueManager: jest.Mocked<any>;
  let mockTransactionService: jest.Mocked<any>;
  let mockConnector: Partial<DAppConnector>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create fresh instance for each test
    tokenQueueService = new TokenQueueService();
    
    // Get reference to mocked manager
    mockQueueManager = (tokenQueueService as any).queueManager;
    
    // Create mock connector
    mockConnector = {};
    
    // Set up connection
    tokenQueueService.updateConnection(mockConnector as DAppConnector, '0.0.12345');
    
    // Get reference to mock transaction service
    mockTransactionService = (tokenQueueService as any).transactionService;
  });
  
  describe('queueTokenApproval', () => {
    it('should enqueue token approval transaction with correct parameters', async () => {
      // Set up parameters with proper type
      const params: TokenApprovalParams = {
        tokenType: 'SAUCE',
        tokenName: 'SAUCE',
        tokenId: '0.0.12345',
        contractId: '0.0.67890',
        amount: '100'
      };
      
      // Call method
      const txId = await tokenQueueService.queueTokenApproval(params);
      
      // Verify transaction was enqueued
      expect(mockQueueManager.enqueue).toHaveBeenCalledTimes(1);
      
      // Verify enqueued transaction has correct name
      const enqueuedTx = mockQueueManager.enqueue.mock.calls[0][0];
      expect(enqueuedTx.name).toBe('SAUCE Approval');
      
      // Verify transaction ID format
      expect(txId).toContain('sauce-approval-');
    });
    
    it('should reject if wallet is not connected', async () => {
      // Create service without wallet connection
      const noWalletService = new TokenQueueService();
      
      // Attempt to queue transaction with proper type
      await expect(noWalletService.queueTokenApproval({
        tokenType: 'SAUCE',
        tokenName: 'SAUCE',
        tokenId: '0.0.12345',
        contractId: '0.0.67890',
        amount: '100'
      } as TokenApprovalParams)).rejects.toThrow('Wallet not connected');
    });
  });
  
  describe('queueMintLynx', () => {
    it('should queue SAUCE and CLXY approvals before minting', async () => {
      // Mock queueTokenApproval to track calls
      tokenQueueService.queueTokenApproval = jest.fn()
        .mockResolvedValueOnce('sauce-approval-id')
        .mockResolvedValueOnce('clxy-approval-id');
      
      // Set up mint params
      const mintParams: MintParams = {
        lynxAmount: 10,
        onSuccess: jest.fn(),
        onError: jest.fn()
      };
      
      // Call mint method
      const result = await tokenQueueService.queueMintLynx(mintParams);
      
      // Verify both token approvals were queued
      expect(tokenQueueService.queueTokenApproval).toHaveBeenCalledTimes(2);
      
      // First call should be SAUCE
      const sauceCall = (tokenQueueService.queueTokenApproval as jest.Mock).mock.calls[0][0];
      expect(sauceCall.tokenType).toBe('SAUCE');
      expect(sauceCall.amount).toBe('50'); // 5 SAUCE per LYNX * 10
      
      // Second call should be CLXY
      const clxyCall = (tokenQueueService.queueTokenApproval as jest.Mock).mock.calls[1][0];
      expect(clxyCall.tokenType).toBe('CLXY');
      expect(clxyCall.amount).toBe('20'); // 2 CLXY per LYNX * 10
      
      // Verify mint transaction was enqueued
      expect(mockQueueManager.enqueue).toHaveBeenCalledTimes(1);
      
      // Verify returned transaction IDs
      expect(result).toEqual({
        sauceApprovalId: 'sauce-approval-id',
        clxyApprovalId: 'clxy-approval-id',
        mintId: expect.stringContaining('mint-lynx-')
      });
    });
    
    it('should verify approval completion before minting', async () => {
      // Mock queueTokenApproval
      tokenQueueService.queueTokenApproval = jest.fn()
        .mockResolvedValueOnce('sauce-approval-id')
        .mockResolvedValueOnce('clxy-approval-id');
      
      // Setup transaction statuses for dependency check and initialize the variable
      let createTransactionFn: Function | undefined;
      
      // Mock enqueue to capture the createTransaction function
      (mockQueueManager.enqueue as jest.Mock).mockImplementation(({ id, createTransaction }) => {
        createTransactionFn = createTransaction;
        return id;
      });
      
      // Mock getTransaction to return completed approvals
      (mockQueueManager.getTransaction as jest.Mock).mockImplementation((id) => {
        if (id === 'sauce-approval-id' || id === 'clxy-approval-id') {
          return { status: 'completed' };
        }
        return undefined;
      });
      
      // Call mint method
      await tokenQueueService.queueMintLynx({ lynxAmount: 10 });
      
      // Check if createTransactionFn was assigned before calling it
      expect(createTransactionFn).toBeDefined();
      
      // Execute the createTransaction function to verify dependencies
      if (createTransactionFn) {
        await createTransactionFn();
      }
      
      // Verify transaction service was called to mint LYNX
      expect(mockTransactionService.mintLynx).toHaveBeenCalledWith(10);
    });
    
    it('should not mint if SAUCE approval failed', async () => {
      // Mock queueTokenApproval
      tokenQueueService.queueTokenApproval = jest.fn()
        .mockResolvedValueOnce('sauce-approval-id')
        .mockResolvedValueOnce('clxy-approval-id');
      
      // Initialize the variable
      let createTransactionFn: Function | undefined;
      
      // Mock enqueue to capture the createTransaction function
      (mockQueueManager.enqueue as jest.Mock).mockImplementation(({ id, createTransaction }) => {
        createTransactionFn = createTransaction;
        return id;
      });
      
      // Mock getTransaction to return failed SAUCE approval
      (mockQueueManager.getTransaction as jest.Mock).mockImplementation((id) => {
        if (id === 'sauce-approval-id') {
          return { status: 'failed', error: new Error('SAUCE approval failed') };
        } else if (id === 'clxy-approval-id') {
          return { status: 'completed' };
        }
        return undefined;
      });
      
      // Call mint method
      await tokenQueueService.queueMintLynx({ lynxAmount: 10 });
      
      // Check if createTransactionFn was assigned before testing it
      expect(createTransactionFn).toBeDefined();
      
      // Execute createTransaction and expect it to throw
      if (createTransactionFn) {
        await expect(createTransactionFn()).rejects.toThrow(/SAUCE approval not completed/);
      }
      
      // Verify mintLynx was not called
      expect(mockTransactionService.mintLynx).not.toHaveBeenCalled();
    });
    
    it('should not mint if CLXY approval failed', async () => {
      // Mock queueTokenApproval
      tokenQueueService.queueTokenApproval = jest.fn()
        .mockResolvedValueOnce('sauce-approval-id')
        .mockResolvedValueOnce('clxy-approval-id');
      
      // Initialize the variable
      let createTransactionFn: Function | undefined;
      
      // Mock enqueue to capture the createTransaction function
      (mockQueueManager.enqueue as jest.Mock).mockImplementation(({ id, createTransaction }) => {
        createTransactionFn = createTransaction;
        return id;
      });
      
      // Mock getTransaction to return failed CLXY approval
      (mockQueueManager.getTransaction as jest.Mock).mockImplementation((id) => {
        if (id === 'sauce-approval-id') {
          return { status: 'completed' };
        } else if (id === 'clxy-approval-id') {
          return { status: 'failed', error: new Error('CLXY approval failed') };
        }
        return undefined;
      });
      
      // Call mint method
      await tokenQueueService.queueMintLynx({ lynxAmount: 10 });
      
      // Check if createTransactionFn was assigned before testing it
      expect(createTransactionFn).toBeDefined();
      
      // Execute createTransaction and expect it to throw
      if (createTransactionFn) {
        await expect(createTransactionFn()).rejects.toThrow(/CLXY approval not completed/);
      }
      
      // Verify mintLynx was not called
      expect(mockTransactionService.mintLynx).not.toHaveBeenCalled();
    });
    
    it('should handle errors during minting', async () => {
      // Mock queueTokenApproval
      tokenQueueService.queueTokenApproval = jest.fn()
        .mockResolvedValueOnce('sauce-approval-id')
        .mockResolvedValueOnce('clxy-approval-id');
      
      // Mock completed approvals
      (mockQueueManager.getTransaction as jest.Mock).mockImplementation((id) => {
        if (id === 'sauce-approval-id' || id === 'clxy-approval-id') {
          return { status: 'completed' };
        }
        return undefined;
      });
      
      // Mock mintLynx to fail
      (mockTransactionService.mintLynx as jest.Mock).mockResolvedValueOnce({
        status: 'error',
        error: new Error('Mint failed')
      });
      
      // Initialize the variable
      let createTransactionFn: Function | undefined;
      
      // Mock enqueue to capture the createTransaction function
      (mockQueueManager.enqueue as jest.Mock).mockImplementation(({ id, createTransaction }) => {
        createTransactionFn = createTransaction;
        return id;
      });
      
      // Call mint method
      await tokenQueueService.queueMintLynx({ lynxAmount: 10 });
      
      // Check if createTransactionFn was assigned before testing it
      expect(createTransactionFn).toBeDefined();
      
      // Execute createTransaction and expect it to throw
      if (createTransactionFn) {
        await expect(createTransactionFn()).rejects.toThrow('Mint failed');
      }
    });
    
    it('should call onError callback if minting fails', async () => {
      // Create mock callbacks
      const onSuccess = jest.fn();
      const onError = jest.fn();
      
      // Mock queueTokenApproval to throw
      tokenQueueService.queueTokenApproval = jest.fn()
        .mockRejectedValueOnce(new Error('Token approval failed'));
      
      // Call mint method with callbacks
      try {
        await tokenQueueService.queueMintLynx({
          lynxAmount: 10,
          onSuccess,
          onError
        });
      } catch (error) {
        // Expected
      }
      
      // Verify error callback was called
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
  
  describe('getTokenRatios', () => {
    it('should return the correct token ratios', () => {
      const ratios = tokenQueueService.getTokenRatios();
      
      expect(ratios).toEqual({
        hbarRatio: 0.01,
        sauceRatio: 5,
        clxyRatio: 2
      });
    });
  });
  
  describe('calculateRequiredHBAR', () => {
    it('should calculate correct HBAR amount required', () => {
      const hbarAmount = tokenQueueService.calculateRequiredHBAR(10);
      
      expect(hbarAmount).toBe(0.1); // 10 LYNX * 0.01 HBAR per LYNX
    });
  });
}); 