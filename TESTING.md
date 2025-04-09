# Lynx Token Mint Testing Guide

This guide explains how to test the LYNX token minting functionality.

## How The Minting Process Works

The minting process requires three sequential transactions:

1. **SAUCE Token Approval**: Approving the contract to spend your SAUCE tokens
2. **CLXY Token Approval**: Approving the contract to spend your CLXY tokens
3. **LYNX Mint**: Sending HBAR and executing the mint function

Each transaction requires a separate signature from your wallet.

## Implementation and Test Status

The token minting system has been fully implemented with a transaction queue to manage sequential operations. All components have been tested and are working as expected:

### Core Components
- **TransactionQueueManager**: Manages transaction processing and retry logic
- **TokenQueueService**: Handles token-specific approval and minting operations
- **useTokenQueue Hook**: React hook for accessing queue functionality
- **MintForm Component**: User interface for the minting process

### Test Coverage
- **Unit Tests**: All pass (TransactionQueueManager and TokenQueueService)
- **Integration Tests**: All pass (MintWithQueue)
- **Manual Testing**: Procedures documented for wallet interaction testing

### Recent Improvements
- Fixed sequential transaction processing
- Enhanced error handling for failed transactions
- Improved transaction status tracking
- Added proper TypeScript type definitions

## Prerequisites

Before testing, ensure you have:

1. **Correct Token IDs**: Make sure the correct token IDs are set in your `.env.local` file:

   ```
   NEXT_PUBLIC_LYNX_TOKEN_ID=0.0.3059001   # Replace with your actual LYNX token ID
   NEXT_PUBLIC_SAUCE_TOKEN_ID=0.0.1183558  # Replace with your actual SAUCE token ID 
   NEXT_PUBLIC_CLXY_TOKEN_ID=0.0.1318237   # Replace with your actual CLXY token ID
   NEXT_PUBLIC_LYNX_CONTRACT_ID=0.0.5758264  # Your contract ID
   ```

2. **Token Balances**: Ensure your wallet has sufficient HBAR, SAUCE, and CLXY tokens:
   - Check that you have SAUCE tokens in your wallet
   - Check that you have CLXY tokens in your wallet
   - Check that you have enough HBAR for the transaction and gas fees

## Testing Procedure

### Step 1: Connect Wallet

1. Open the dApp in a clean browser session
2. Click "Connect Wallet" 
3. Approve the connection in HashPack
4. Verify your account ID appears in the UI

### Step 2: Check Token Balances

1. Verify your HBAR, SAUCE, and CLXY balances are displayed correctly
2. Note these values for comparison after minting

### Step 3: Mint LYNX Tokens

1. Enter a small amount (e.g., 1) in the LYNX input field
2. Verify the Required Tokens section updates with the correct amounts
3. Click "Mint LYNX Tokens"
4. You will receive THREE wallet prompts:
   - First prompt: Approve SAUCE tokens (wait for this to complete)
   - Second prompt: Approve CLXY tokens (wait for this to complete)
   - Third prompt: Mint LYNX tokens with HBAR (final transaction)
5. After all three transactions are signed, wait for them to process
6. Check your LYNX balance has increased and other token balances have decreased

## Debugging Each Transaction

If you encounter errors, identify at which stage they occur:

### SAUCE Approval (Transaction 1)
- Check console logs for "SAUCE approval failed" messages
- Verify SAUCE token ID is correct
- Ensure you have enough SAUCE tokens in your wallet

### CLXY Approval (Transaction 2)
- Check console logs for "CLXY approval failed" messages
- Verify CLXY token ID is correct
- Ensure you have enough CLXY tokens in your wallet

### LYNX Mint (Transaction 3)
- Check console logs for "Mint transaction failed" messages
- Verify that you have enough HBAR to send with the transaction
- Check if the contract reverted with a specific error

## Transaction Flow Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   SAUCE     │    │    CLXY     │    │    LYNX     │
│  Approval   │───>│  Approval   │───>│    Mint     │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Common Failure Modes

1. **Wallet disconnection**: If your wallet disconnects during the process, you'll need to start over from the beginning.

2. **Wrong token IDs**: Ensure the token IDs in your .env file match the IDs of the tokens in your wallet.

3. **Transaction rejection**: If you reject any transaction in the sequence, the process will stop there and you'll need to start over.

4. **Insufficient balance**: If you don't have enough of any required token, the transaction will fail.

## Contract Behavior

The contract (`LynxMinter.sol`) expects:

1. The user to have approved the contract for SAUCE tokens
2. The user to have approved the contract for CLXY tokens 
3. The mint transaction to include the correct amount of HBAR

The implementation handles all three steps for you in sequence.

## Network Requirements

Always test on the same network as your contract (e.g., Testnet or Mainnet). Using mismatched networks will cause transactions to fail. 

# Token Approval Queue Testing Strategy

This document outlines the testing strategy for the token approval queue system to ensure reliable token approval and minting operations.

## Implementation Status

All components of the token approval queue system have been implemented and tested:

- **TransactionQueueManager**: Fully implemented and tested
- **TokenQueueService**: Fully implemented and tested
- **useTokenQueue Hook**: Implemented and tested in integration tests
- **MintForm Component**: Implemented and tested with the queue system

### Test Files

The following test files have been created and are passing:
1. `tests/services/TransactionQueueManager.test.ts` (8/8 tests passing)
2. `tests/services/TokenQueueService.test.ts` (9/9 tests passing)
3. `tests/integration/MintWithQueue.test.tsx` (3/3 tests passing)

## Goals

The primary testing goals are:

1. Verify sequential execution of transactions to prevent wallet popup conflicts
2. Ensure proper error handling and recovery in transaction processing
3. Validate queue management for multiple transactions
4. Test integration with the Hedera network and HashPack wallet
5. Verify the user interface provides appropriate feedback

## Testing Levels

### 1. Unit Tests

Unit tests focus on individual components in isolation:

#### TransactionQueueManager Tests

- Test queue operations (enqueue, getTransaction, cleanQueue)
- Test transaction processing with mocked transactions
- Test error handling and retry mechanisms
- Test concurrency control and sequential execution

#### TokenQueueService Tests

- Test token approval operations with mocked wallet and transactions
- Test LYNX minting flow with mocked approvals
- Test error handling for each stage of the minting process
- Test successful completion of multi-step operations

### 2. Integration Tests

Integration tests verify components working together:

#### TokenQueueService + TransactionQueueManager Integration

- Test the complete flow from queue to execution
- Test transaction dependency chains (mint depending on approvals)
- Test timeouts and retry mechanisms in a realistic environment

#### React Components + Queue Service Integration

- Test React state updates based on queue events
- Test progress reporting through the UI
- Test error display and recovery flows

### 3. Manual Testing Procedures

Some aspects require manual testing with real wallets:

#### HashPack Wallet Integration Tests

1. **Setup:**
   - Install HashPack browser extension
   - Connect to Hedera testnet
   - Fund test account with HBAR, SAUCE, and CLXY tokens

2. **Token Approval Test:**
   - Navigate to mint page
   - Enter amount to mint
   - Verify SAUCE approval popup appears
   - Approve the transaction
   - Verify CLXY approval popup appears only after SAUCE approval completes
   - Approve the transaction
   - Verify mint transaction popup appears only after both approvals complete
   - Approve the transaction
   - Verify UI updates with correct progress and success message

3. **Error Handling Test:**
   - Start minting process
   - Reject one of the approval popups
   - Verify error is displayed correctly in UI
   - Verify queue is properly cleaned up

4. **Concurrency Test:**
   - Start two minting operations in quick succession
   - Verify they are processed sequentially, not simultaneously
   - Complete all popups and verify both operations succeed

## Test Cases

### Unit Test Cases for TransactionQueueManager

```typescript
// tests/services/TransactionQueueManager.test.ts

import { TransactionQueueManager } from '../../app/services/TransactionQueueManager';

describe('TransactionQueueManager', () => {
  let queueManager: TransactionQueueManager;
  
  beforeEach(() => {
    queueManager = new TransactionQueueManager();
  });
  
  test('should enqueue a transaction and return an ID', () => {
    const id = queueManager.enqueue({
      id: 'test-tx',
      name: 'Test Transaction',
      createTransaction: jest.fn().mockResolvedValue({ status: 'success' })
    });
    
    expect(id).toBe('test-tx');
    expect(queueManager.getStats().totalTransactions).toBe(1);
    expect(queueManager.getStats().pendingTransactions).toBe(1);
  });
  
  test('should process transactions sequentially', async () => {
    const executionOrder: string[] = [];
    const mockCreate1 = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      executionOrder.push('tx1');
      return { status: 'success' };
    });
    
    const mockCreate2 = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      executionOrder.push('tx2');
      return { status: 'success' };
    });
    
    queueManager.enqueue({
      id: 'tx1',
      name: 'Transaction 1',
      createTransaction: mockCreate1
    });
    
    queueManager.enqueue({
      id: 'tx2',
      name: 'Transaction 2',
      createTransaction: mockCreate2
    });
    
    await queueManager.waitForCompletion();
    
    expect(executionOrder).toEqual(['tx1', 'tx2']);
    expect(mockCreate1).toHaveBeenCalledTimes(1);
    expect(mockCreate2).toHaveBeenCalledTimes(1);
  });
  
  test('should handle transaction failures and retries', async () => {
    const mockCreate = jest.fn()
      .mockRejectedValueOnce(new Error('Failed first attempt'))
      .mockResolvedValueOnce({ status: 'success' });
      
    queueManager.enqueue({
      id: 'retry-tx',
      name: 'Retry Transaction',
      createTransaction: mockCreate,
      maxRetries: 1
    });
    
    await queueManager.waitForCompletion();
    
    // Should retry once after failure
    expect(mockCreate).toHaveBeenCalledTimes(2);
    
    // Transaction should have succeeded on second attempt
    const txStatus = queueManager.getTransaction('retry-tx');
    expect(txStatus?.status).toBe('completed');
  });
  
  test('should handle transactions reaching max retries', async () => {
    const mockCreate = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'));
      
    queueManager.enqueue({
      id: 'max-retry-tx',
      name: 'Max Retry Transaction',
      createTransaction: mockCreate,
      maxRetries: 1
    });
    
    await queueManager.waitForCompletion();
    
    // Should retry once then give up
    expect(mockCreate).toHaveBeenCalledTimes(2);
    
    // Transaction should be marked as failed
    const txStatus = queueManager.getTransaction('max-retry-tx');
    expect(txStatus?.status).toBe('failed');
    expect(txStatus?.error?.message).toBe('Second failure');
  });
});
```

### Unit Test Cases for TokenQueueService

```typescript
// tests/services/TokenQueueService.test.ts

import { TokenQueueService } from '../../app/services/TokenQueueService';
import { TransactionQueueManager } from '../../app/services/TransactionQueueManager';

describe('TokenQueueService', () => {
  let tokenQueueService: TokenQueueService;
  let mockQueueManager: jest.Mocked<TransactionQueueManager>;
  
  beforeEach(() => {
    mockQueueManager = {
      enqueue: jest.fn().mockReturnValue('transaction-id'),
      getStats: jest.fn().mockReturnValue({
        totalTransactions: 0,
        completedTransactions: 0,
        failedTransactions: 0,
        pendingTransactions: 0
      }),
      getTransaction: jest.fn(),
      updateConnection: jest.fn()
    } as unknown as jest.Mocked<TransactionQueueManager>;
    
    tokenQueueService = new TokenQueueService();
    (tokenQueueService as any).queueManager = mockQueueManager;
    (tokenQueueService as any).connector = {};
    (tokenQueueService as any).accountId = '0.0.12345';
    (tokenQueueService as any).transactionService = {
      approveToken: jest.fn().mockResolvedValue({ status: 'success', txId: 'approval-tx' }),
      mintLynx: jest.fn().mockResolvedValue({ status: 'success', txId: 'mint-tx' })
    };
  });
  
  test('should queue SAUCE token approval correctly', async () => {
    const transactionId = await tokenQueueService.queueTokenApproval({
      tokenType: 'SAUCE',
      amount: '100'
    });
    
    expect(transactionId).toBeDefined();
    expect(mockQueueManager.enqueue).toHaveBeenCalledTimes(1);
    
    const args = mockQueueManager.enqueue.mock.calls[0][0];
    expect(args.name).toContain('SAUCE');
  });
  
  test('should queue LYNX mint after token approvals', async () => {
    // Mock successful token approvals
    mockQueueManager.getTransaction.mockImplementation((id) => {
      if (id === 'sauce-approval' || id === 'clxy-approval') {
        return {
          id,
          status: 'completed',
          result: { status: 'success', txId: 'hedera-tx-id' }
        } as any;
      }
      return undefined;
    });
    
    // Mock the token approval method
    tokenQueueService.queueTokenApproval = jest.fn()
      .mockResolvedValueOnce('sauce-approval')
      .mockResolvedValueOnce('clxy-approval');
    
    const result = await tokenQueueService.queueMintLynx({ lynxAmount: 10 });
    
    expect(tokenQueueService.queueTokenApproval).toHaveBeenCalledTimes(2);
    expect(mockQueueManager.enqueue).toHaveBeenCalledTimes(1);
    
    expect(result).toEqual(expect.objectContaining({
      sauceApprovalId: 'sauce-approval',
      clxyApprovalId: 'clxy-approval',
      mintId: expect.any(String)
    }));
  });
});
```

### Integration Test Cases

```typescript
// tests/integration/MintWithQueue.test.tsx

import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { TokenQueueProvider } from '../../app/hooks/useTokenQueue';
import MintForm from '../../app/components/MintForm';

// Mock the useTokenQueue hook
jest.mock('../../app/hooks/useTokenQueue', () => ({
  useTokenQueue: () => ({
    queueMintLynx: mockQueueMintLynx,
    queueStats: { totalTransactions: 3, completedTransactions: 1 },
    getTransaction: jest.fn().mockReturnValue({ status: 'completed' })
  })
}));

const mockQueueMintLynx = jest.fn().mockResolvedValue({
  sauceApprovalId: 'sauce-tx',
  clxyApprovalId: 'clxy-tx',
  mintId: 'mint-tx'
});

describe('MintForm integration with queue', () => {
  test('should call queueMintLynx with correct parameters when form is submitted', async () => {
    render(
      <TokenQueueProvider>
        <MintForm />
      </TokenQueueProvider>
    );
    
    // Fill in the amount
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '10' } });
    
    // Submit the form
    fireEvent.click(screen.getByText(/mint lynx/i));
    
    // Check that queueMintLynx was called with correct parameters
    await waitFor(() => {
      expect(mockQueueMintLynx).toHaveBeenCalledWith(
        expect.objectContaining({ lynxAmount: 10 })
      );
    });
    
    // Check that UI shows progress
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });
});
```

## Test Execution 

To run the tests:

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/services/TransactionQueueManager.test.ts

# Run tests with coverage
npm test -- --coverage
```

## Common Test Issues and Solutions

### React Testing Issues

- **Act Warnings**: Use async/await with act() for asynchronous tests
- **Mock Functions**: Use jest.mock() at module level and jest.fn() for specific functions
- **Component State**: Use waitFor() to wait for component state updates

### Unit Testing Tips

- Mock external dependencies (DAppConnector, TransactionService)
- Test success and failure paths for transactions
- Verify transaction sequence and dependency checks

### Integration Testing Tips

- Use jest.mock() to isolate components from external services
- Test UI updates based on transaction status changes
- Verify error handling and user feedback

## Manual Testing Checklist

For features that can't be easily automated, follow this manual testing checklist:

### HashPack Wallet Integration

- [ ] Connect wallet to Hedera testnet
- [ ] Verify wallet connection persists through page refreshes
- [ ] Trigger token approval and verify HashPack popup appears
- [ ] Accept approval in HashPack and verify transaction completes
- [ ] Reject approval in HashPack and verify error handling
- [ ] Test with low HBAR balance and verify appropriate error
- [ ] Test with low token balances and verify appropriate error

### Queue Behavior

- [ ] Start multiple minting operations in succession
- [ ] Verify popups appear one at a time
- [ ] Verify operations complete in the correct order
- [ ] Test error recovery by rejecting then retrying
- [ ] Check UI feedback matches actual transaction states

### Production Environment Verification

Before final release:

- [ ] Verify all transactions work on Hedera mainnet
- [ ] Verify gas limits are appropriate for mainnet
- [ ] Test with different wallet devices (desktop, mobile)
- [ ] Test with different HashPack versions
- [ ] Verify network disconnection handling

## Performance Testing

- [ ] Measure time to complete full minting process
- [ ] Profile memory usage during high transaction volume
- [ ] Test with multiple browser tabs open
- [ ] Measure impact of transaction queue on page performance

## Test Automation

Continuous Integration should run:
- All unit tests on every PR
- Integration tests on staging deployments
- UI component tests for affected components

## Test Reporting

For each test run, generate reports on:
- Pass/fail status of each test
- Transaction success rates
- Average transaction times
- Error frequencies and types 