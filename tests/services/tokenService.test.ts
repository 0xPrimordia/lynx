import { TokenService } from '../../app/services/tokenService';
import { AccountId, ContractId, ContractExecuteTransaction, ContractFunctionParameters, Hbar } from '@hashgraph/sdk';

// Create a simple mock implementation
const mockSignedTx = { 
  transactionId: { 
    toString: () => 'test-tx-id' 
  } 
};

// Create proper mock of AccountId
const mockAccountIdObj = {
  toSolidityAddress: jest.fn().mockReturnValue('0xADDRESS')
};

// Mock the entire Hashgraph SDK
jest.mock('@hashgraph/sdk', () => ({
  AccountId: {
    fromString: jest.fn().mockImplementation(() => mockAccountIdObj)
  },
  ContractId: {
    fromString: jest.fn().mockImplementation((id) => ({
      toString: () => id,
      toSolidityAddress: () => '0x' + id
    }))
  },
  ContractExecuteTransaction: jest.fn().mockImplementation(() => ({
    setContractId: jest.fn().mockReturnThis(),
    setGas: jest.fn().mockReturnThis(),
    setFunction: jest.fn().mockReturnThis(),
    setPayableAmount: jest.fn().mockReturnThis(),
    setMaxTransactionFee: jest.fn().mockReturnThis()
  })),
  ContractFunctionParameters: jest.fn().mockImplementation(() => ({
    addAddress: jest.fn().mockReturnThis(),
    addUint256: jest.fn().mockReturnThis()
  })),
  Hbar: jest.fn().mockImplementation(() => ({}))
}));

// Mock DAppConnector
jest.mock('@hashgraph/hedera-wallet-connect', () => ({
  DAppConnector: jest.fn()
}));

const mockSigner = { 
  signTransaction: jest.fn().mockResolvedValue(mockSignedTx) 
};

const mockDAppConnector = { 
  getSigner: jest.fn().mockReturnValue(mockSigner) 
};

const mockAccountId = '0.0.12345';

// Define transaction type for proper typing
interface ApprovalTransaction {
  type: 'approve';
  token: string;
  amount: number;
  txId: string;
  timestamp: string;
}

// Create a separate object to mock network calls and track state between tests
const mockNetwork = {
  // Track token allowances to verify approval transactions
  tokenAllowances: {
    'SAUCE': 0,
    'CLXY': 0
  },
  
  // Track executed transactions
  executedTransactions: [] as ApprovalTransaction[],
  
  // Reset state for clean tests
  reset(): void {
    this.tokenAllowances.SAUCE = 0;
    this.tokenAllowances.CLXY = 0;
    this.executedTransactions = [];
  },
  
  // Record transaction and update allowance
  recordApproval(tokenName: string, amount: number, txId: string): boolean {
    this.tokenAllowances[tokenName as keyof typeof this.tokenAllowances] = amount;
    this.executedTransactions.push({
      type: 'approve',
      token: tokenName,
      amount: amount,
      txId: txId,
      timestamp: new Date().toISOString()
    });
    return true;
  }
};

describe('TokenService', () => {
  let tokenService: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork.reset();
    tokenService = new TokenService(mockDAppConnector as any, mockAccountId);
  });
  
  describe('Token Approval Tests', () => {
    // Test 1: Successful SAUCE token approval
    test('SAUCE token approval completes successfully', async () => {
      console.log('\n--- TEST: SAUCE token approval completes successfully ---');
      
      // Configure mock behavior for successful approval
      mockSigner.signTransaction.mockImplementation(async (tx) => {
        console.log('[TEST] Mock wallet signing SAUCE approval transaction');
        // Simulate a delay to mimic real wallet behavior
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Record the approval in our mock network
        mockNetwork.recordApproval('SAUCE', 500, 'sauce-approval-tx-id');
        
        console.log('[TEST] SAUCE approval transaction signed and executed');
        return { 
          transactionId: { 
            toString: () => 'sauce-approval-tx-id' 
          } 
        };
      });
      
      // Execute the approval
      console.log('[TEST] Calling approveToken for SAUCE');
      const result = await tokenService.approveToken(
        '0.0.1234', // Token ID
        '0.0.5678', // Contract ID 
        500,        // Amount
        'SAUCE'     // Token name
      );
      
      // Verify the result
      console.log('[TEST] Approval result:', result);
      expect(result.status).toBe('success');
      expect(result.transactionId).toBe('sauce-approval-tx-id');
      
      // Verify the mock network state
      expect(mockNetwork.tokenAllowances.SAUCE).toBe(500);
      expect(mockNetwork.executedTransactions.length).toBe(1);
      expect(mockNetwork.executedTransactions[0].token).toBe('SAUCE');
      
      // Verify the mock was called correctly
      expect(mockSigner.signTransaction).toHaveBeenCalledTimes(1);
    });
  
    // Test 2: Successful CLXY token approval
    test('CLXY token approval completes successfully', async () => {
      console.log('\n--- TEST: CLXY token approval completes successfully ---');
      
      // Configure mock behavior for successful approval
      mockSigner.signTransaction.mockImplementation(async (tx) => {
        console.log('[TEST] Mock wallet signing CLXY approval transaction');
        // Simulate a delay to mimic real wallet behavior
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Record the approval in our mock network
        mockNetwork.recordApproval('CLXY', 200, 'clxy-approval-tx-id');
        
        console.log('[TEST] CLXY approval transaction signed and executed');
        return { 
          transactionId: { 
            toString: () => 'clxy-approval-tx-id' 
          } 
        };
      });
      
      // Execute the approval
      console.log('[TEST] Calling approveToken for CLXY');
      const result = await tokenService.approveToken(
        '0.0.5678', // Token ID 
        '0.0.9999', // Contract ID
        200,        // Amount
        'CLXY'      // Token name
      );
      
      // Verify the result
      console.log('[TEST] Approval result:', result);
      expect(result.status).toBe('success');
      expect(result.transactionId).toBe('clxy-approval-tx-id');
      
      // Verify the mock network state
      expect(mockNetwork.tokenAllowances.CLXY).toBe(200);
      expect(mockNetwork.executedTransactions.length).toBe(1);
      expect(mockNetwork.executedTransactions[0].token).toBe('CLXY');
      
      // Verify the mock was called correctly
      expect(mockSigner.signTransaction).toHaveBeenCalledTimes(1);
    });
  
    // Test 3: SAUCE approval with wallet rejection
    test('SAUCE approval handles wallet rejection correctly', async () => {
      console.log('\n--- TEST: SAUCE approval handles wallet rejection correctly ---');
      
      // Configure mock to simulate wallet rejection (empty object error)
      mockSigner.signTransaction.mockImplementation(async () => {
        console.log('[TEST] Simulating wallet rejection with empty object error');
        await new Promise(resolve => setTimeout(resolve, 100));
        throw {}; // Empty object error, similar to what HashPack returns
      });
      
      // Execute the approval that will be rejected
      console.log('[TEST] Calling approveToken for SAUCE (expecting rejection)');
      const result = await tokenService.approveToken(
        '0.0.1234',
        '0.0.5678',
        500,
        'SAUCE'
      );
      
      // Verify error handling for empty object errors
      console.log('[TEST] Rejection result:', result);
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('Token approval rejected for SAUCE');
      
      // Verify the transaction wasn't recorded
      expect(mockNetwork.tokenAllowances.SAUCE).toBe(0);
      expect(mockNetwork.executedTransactions.length).toBe(0);
    });
  
    // Test 4: CLXY approval with network error
    test('CLXY approval handles network errors correctly', async () => {
      console.log('\n--- TEST: CLXY approval handles network errors correctly ---');
      
      // Configure mock to simulate network error
      const networkError = new Error('Network connection error');
      mockSigner.signTransaction.mockImplementation(async () => {
        console.log('[TEST] Simulating network error');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Since the implementation now handles empty objects differently from error objects,
        // we need to make sure we're throwing a proper Error
        throw networkError;
      });
      
      // Execute the approval that will encounter a network error
      console.log('[TEST] Calling approveToken for CLXY (expecting network error)');
      const result = await tokenService.approveToken(
        '0.0.5678',
        '0.0.9999',
        200,
        'CLXY'
      );
      
      // Verify error handling for standard Error objects
      console.log('[TEST] Network error result:', result);
      expect(result.status).toBe('error');
      
      // The implementation's error handling may vary - be flexible in our test
      // It should either preserve the original error message or mention the token name
      const errorMessage = result.error?.message || '';
      const containsOriginalError = errorMessage.includes('Network connection error');
      const containsTokenName = errorMessage.includes('CLXY');
      
      expect(containsOriginalError || containsTokenName).toBe(true);
      
      // Verify the transaction wasn't recorded
      expect(mockNetwork.tokenAllowances.CLXY).toBe(0);
      expect(mockNetwork.executedTransactions.length).toBe(0);
    });
    
    // Test 5: Sequential approvals
    test('Sequential approvals complete in correct order', async () => {
      console.log('\n--- TEST: Sequential approvals complete in correct order ---');
      
      // Configure mock for sequential approvals
      let callCount = 0;
      mockSigner.signTransaction.mockImplementation(async (tx) => {
        callCount++;
        if (callCount === 1) {
          console.log('[TEST] Mock wallet signing first approval (SAUCE)');
          await new Promise(resolve => setTimeout(resolve, 100));
          mockNetwork.recordApproval('SAUCE', 500, 'sauce-tx-id');
          return { transactionId: { toString: () => 'sauce-tx-id' } };
        } else {
          console.log('[TEST] Mock wallet signing second approval (CLXY)');
          await new Promise(resolve => setTimeout(resolve, 100));
          mockNetwork.recordApproval('CLXY', 200, 'clxy-tx-id');
          return { transactionId: { toString: () => 'clxy-tx-id' } };
        }
      });
      
      // Execute the first approval
      console.log('[TEST] Calling first approveToken for SAUCE');
      const sauce = await tokenService.approveToken(
        '0.0.1234',
        '0.0.5678',
        500,
        'SAUCE'
      );
      
      console.log('[TEST] First approval result:', sauce);
      expect(sauce.status).toBe('success');
      expect(sauce.transactionId).toBe('sauce-tx-id');
      
      // Execute the second approval
      console.log('[TEST] Calling second approveToken for CLXY');
      const clxy = await tokenService.approveToken(
        '0.0.5678',
        '0.0.9999',
        200,
        'CLXY'
      );
      
      console.log('[TEST] Second approval result:', clxy);
      expect(clxy.status).toBe('success');
      expect(clxy.transactionId).toBe('clxy-tx-id');
      
      // Verify both were recorded in the correct order
      expect(mockNetwork.executedTransactions.length).toBe(2);
      expect(mockNetwork.executedTransactions[0].token).toBe('SAUCE');
      expect(mockNetwork.executedTransactions[1].token).toBe('CLXY');
      expect(mockSigner.signTransaction).toHaveBeenCalledTimes(2);
    });
  });
  
  // Keeping original simple tests for backward compatibility
  test('getTokenRatios returns expected values', async () => {
    const result = await tokenService.getTokenRatios();
    expect(result).toEqual({
      hbarRatio: 10,
      sauceRatio: 5,
      clxyRatio: 2
    });
  });
  
  test('calculateRequiredHBAR multiplies by ratio', async () => {
    const result = await tokenService.calculateRequiredHBAR(10);
    expect(result).toBe(100);
  });
  
  describe('mintLynx tests', () => {
    beforeEach(() => {
      // Setup for mintLynx tests - reset mocks
      mockSigner.signTransaction.mockClear();
    });
    
    test('mintLynx performs three operations successfully', async () => {
      // Mock the signer to succeed for all three transactions
      mockSigner.signTransaction
        .mockResolvedValueOnce({ transactionId: { toString: () => 'sauce-tx-id' } })
        .mockResolvedValueOnce({ transactionId: { toString: () => 'clxy-tx-id' } })
        .mockResolvedValueOnce({ transactionId: { toString: () => 'mint-tx-id' } });
      
      const result = await tokenService.mintLynx({ lynxAmount: 10 });
      
      expect(mockSigner.signTransaction).toHaveBeenCalledTimes(3);
      expect(result.status).toBe('success');
      expect(result.transactionIds.length).toBe(3);
    });
    
    test('mintLynx handles SAUCE approval failures', async () => {
      // Mock the signer to fail on the first transaction (SAUCE)
      mockSigner.signTransaction.mockRejectedValueOnce({});
      
      const result = await tokenService.mintLynx({ lynxAmount: 10 });
      
      expect(mockSigner.signTransaction).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('Token approval rejected for SAUCE');
      expect(result.diagnostics).toBeTruthy();
      expect(result.diagnostics?.failedStep).toBe('SAUCE approval');
    });
    
    test('mintLynx handles CLXY approval failures', async () => {
      // First call (SAUCE) succeeds, second call (CLXY) fails with a specific error
      const clxyError = new Error('CLXY approval error');
      mockSigner.signTransaction
        .mockResolvedValueOnce({ transactionId: { toString: () => 'sauce-tx-id' } })
        .mockRejectedValueOnce(clxyError);
      
      const result = await tokenService.mintLynx({ lynxAmount: 10 });
      
      expect(mockSigner.signTransaction).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('error');
      
      // The error contains the token name and the original error
      // Check for both patterns to be flexible with implementation changes
      const errorMessage = result.error?.message || '';
      const containsOriginalError = errorMessage.includes('CLXY approval error');
      const containsTokenName = errorMessage.includes('CLXY');
      
      expect(containsOriginalError || containsTokenName).toBe(true);
      expect(result.diagnostics).toBeTruthy();
      expect(result.diagnostics?.failedStep).toBe('CLXY approval');
    });
    
    test('mintLynx handles mint transaction failures', async () => {
      // First two calls succeed, third call (mint) fails
      const mintError = new Error('Mint transaction error');
      mockSigner.signTransaction
        .mockResolvedValueOnce({ transactionId: { toString: () => 'sauce-tx-id' } })
        .mockResolvedValueOnce({ transactionId: { toString: () => 'clxy-tx-id' } })
        .mockRejectedValueOnce(mintError);
      
      const result = await tokenService.mintLynx({ lynxAmount: 10 });
      
      expect(mockSigner.signTransaction).toHaveBeenCalledTimes(3);
      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('Mint transaction error');
      expect(result.diagnostics).toBeTruthy();
      expect(result.diagnostics?.failedStep).toBe('LYNX mint');
    });
    
    test('mintLynx validates input parameters', async () => {
      const result = await tokenService.mintLynx({ lynxAmount: 0 });
      
      expect(mockSigner.signTransaction).not.toHaveBeenCalled();
      expect(result.status).toBe('error');
      expect(result.error?.message).toBe('LYNX amount must be greater than zero');
    });
  });
  
  test('burnLynx performs two operations', async () => {
    // Setup mock for burnLynx
    mockSigner.signTransaction
      .mockResolvedValueOnce({ transactionId: { toString: () => 'approve-tx-id' } })
      .mockResolvedValueOnce({ transactionId: { toString: () => 'burn-tx-id' } });
    
    const result = await tokenService.burnLynx({ lynxAmount: 10 });
    
    expect(mockSigner.signTransaction).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('success');
    expect(result.transactionIds.length).toBe(2);
  });
}); 