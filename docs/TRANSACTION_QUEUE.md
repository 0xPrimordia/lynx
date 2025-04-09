# Transaction Queue System

## Overview

The Transaction Queue System provides a robust solution for managing Hedera token approvals and transactions, ensuring they execute sequentially without interference. This system solves common issues with crypto wallet popups by coordinating transaction timing and providing better error handling.

## Problem Statement

When minting LYNX tokens, users need to approve both SAUCE and CLXY tokens before the actual mint can proceed. With the standard implementation:

1. Multiple wallet popups appear simultaneously, confusing users
2. Transactions may interfere with each other when executed in rapid succession
3. Empty error objects are returned when a wallet popup is closed prematurely
4. Error handling is inconsistent between different transaction stages

## Architecture

The Transaction Queue System consists of three main components:

### 1. TransactionQueueManager

The core transaction coordination engine responsible for:

- Managing a queue of pending transactions
- Processing transactions sequentially with configurable delays
- Implementing retry logic for failed transactions
- Tracking transaction status (pending, processing, completed, failed)
- Providing queue statistics for UI feedback

```typescript
// Basic usage
const queueManager = new TransactionQueueManager({
  connector: walletConnector,
  accountId: userAccountId,
  defaultDelayMs: 1000, // Wait 1 second between transactions
  defaultMaxRetries: 2
});

queueManager.enqueue({
  id: 'transaction-id',
  name: 'My Transaction',
  createTransaction: async () => {
    // Logic to create and execute transaction
    return { status: 'success', txId: 'tx-id' };
  },
  onSuccess: (result) => console.log('Success', result),
  onError: (error) => console.error('Failed', error),
  delayMs: 2000, // Override default delay
  maxRetries: 3 // Override default retries
});
```

### 2. TokenQueueService

A specialized service for token operations that:

- Provides token-specific transaction creation for SAUCE, CLXY and LYNX
- Manages approval transaction IDs for dependency tracking
- Validates token approvals before attempting minting
- Handles token-specific error conditions

```typescript
// Basic usage
const tokenQueueService = new TokenQueueService({
  queueManager,
  connector: walletConnector,
  accountId: userAccountId
});

// Queue a token approval
await tokenQueueService.queueTokenApproval({
  tokenType: 'SAUCE',
  amount: '100',
  spenderContract: contractId
});

// Queue LYNX minting (requires prior token approvals)
await tokenQueueService.queueMintLynx({
  lynxAmount: 10,
  requiredSauce: '100',
  requiredClxy: '200'
});
```

### 3. React Hook (useTokenQueue)

A React hook that provides:

- Context for accessing queue services throughout the app
- State management for tracking transaction progress
- Automatic connection to the wallet provider
- UI feedback mechanisms for transaction status

```typescript
// In a React component
const { 
  queueTokenApproval,
  queueMintLynx,
  queueStats,
  getTransactionStatus
} = useTokenQueue();

// Show progress to the user
const { totalTransactions, completedTransactions } = queueStats;
const progress = totalTransactions > 0 
  ? (completedTransactions / totalTransactions) * 100 
  : 0;
```

## Implementation Status

As of the latest update, all components of the Transaction Queue System have been fully implemented and tested:

- **TransactionQueueManager**: Implemented with sequential processing, error handling, and retry logic. All unit tests pass successfully.
- **TokenQueueService**: Implemented with token-specific operations for SAUCE, CLXY, and LYNX tokens. All unit tests pass successfully.
- **useTokenQueue Hook**: Implemented with React context for app-wide access to queue services. Integration tests verify functionality.
- **MintForm Component**: Implemented using the useTokenQueue hook to handle the entire minting process with proper UI feedback.

The following fixes and improvements have been made to the original implementation:

1. Fixed issues with the TransactionQueueManager's sequential processing to ensure transactions execute in the correct order
2. Enhanced error handling in the TokenQueueService to properly validate approval prerequisites
3. Improved transaction status tracking and reporting
4. Added type definitions for the TransactionService to ensure compatibility
5. Streamlined the MintForm component to handle both string and object result types from minting operations

## Key Benefits

1. **Sequential Execution**: Transactions are processed one at a time, ensuring wallet popups appear in sequence, not simultaneously.

2. **Configurable Delays**: Add necessary pauses between transactions to prevent race conditions.

3. **Automatic Retries**: Transactions can automatically retry on failure, with configurable retry limits.

4. **Consistent Error Handling**: Standardized approach to error management across all transaction types.

5. **Dependency Tracking**: Ensure transactions execute in the correct order with prerequisite validation.

6. **Progress Monitoring**: Track the status of all queued transactions for UI feedback.

## Usage Guide

### Setting Up

1. Add the provider to your application:

```tsx
// In your app
import { TokenQueueProvider } from './hooks/useTokenQueue';

function App() {
  return (
    <TokenQueueProvider>
      <YourApp />
    </TokenQueueProvider>
  );
}
```

2. Use the hook in your components:

```tsx
import { useTokenQueue } from './hooks/useTokenQueue';

function MintComponent() {
  const { 
    queueTokenApproval, 
    queueMintLynx,
    queueStats,
    isProcessing
  } = useTokenQueue();

  async function handleMint(amount) {
    try {
      // Queue SAUCE approval
      const sauceApprovalId = await queueTokenApproval({
        tokenType: 'SAUCE',
        amount: requiredSauce
      });

      // Queue CLXY approval
      const clxyApprovalId = await queueTokenApproval({
        tokenType: 'CLXY',
        amount: requiredClxy
      });

      // Queue the mint operation
      const mintId = await queueMintLynx({
        lynxAmount: amount,
        requiredSauce,
        requiredClxy
      });
    } catch (error) {
      console.error('Minting failed:', error);
    }
  }

  return (
    <div>
      <button 
        onClick={() => handleMint(10)} 
        disabled={isProcessing}
      >
        Mint LYNX
      </button>
      {isProcessing && (
        <ProgressBar 
          value={queueStats.completedTransactions} 
          max={queueStats.totalTransactions} 
        />
      )}
    </div>
  );
}
```

## Test Status

All components now have comprehensive test coverage:

1. **Unit Tests**: 
   - TransactionQueueManager.test.ts - 8/8 tests passing
   - TokenQueueService.test.ts - 9/9 tests passing
   
2. **Integration Tests**:
   - MintWithQueue.test.tsx - 3/3 tests passing

The testing strategy validates:
- Sequential transaction processing
- Error handling and recovery
- Dependency validation between transactions
- UI component integration

## Troubleshooting

### Common Issues

1. **Transaction Timeout**: If a transaction takes too long, the system will retry based on the configured max retries.

2. **Sequential Dependency Failure**: If a required prior transaction fails, dependent transactions will not execute.

3. **Wallet Disconnection**: If the wallet disconnects during processing, you'll need to reconnect and restart the process.

### Debugging

The queue system provides detailed transaction tracking:

```typescript
// Get details about a specific transaction
const txStatus = tokenQueueService.getTransaction('transaction-id');
console.log(txStatus);
// {
//   id: 'transaction-id',
//   name: 'SAUCE Approval',
//   status: 'completed', // or 'failed', 'pending', 'processing'
//   attempts: 2,
//   timestamp: 1677721600000,
//   result: { status: 'success', txId: 'hedera-tx-id' },
//   error: Error('Transaction failed') // only present if status is 'failed'
// }

// Get overall queue statistics
const stats = tokenQueueService.getQueueStats();
console.log(stats);
// {
//   totalTransactions: 3,
//   completedTransactions: 2,
//   failedTransactions: 1,
//   pendingTransactions: 0
// }
```

## Further Resources

For more information, see:
- [TESTING.md](../TESTING.md) for detailed testing strategy and procedures
- [TOKEN_APPROVAL_FLOW.md](./TOKEN_APPROVAL_FLOW.md) for user-facing documentation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions 