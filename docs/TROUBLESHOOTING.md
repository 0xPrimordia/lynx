# Transaction Queue System: Troubleshooting Guide

This guide addresses common issues developers may encounter when working with the Transaction Queue System for Hedera token approvals and minting operations.

## Implementation Status and Known Issues

As of the latest update, all core components of the Transaction Queue System have been implemented and tested:

- **TransactionQueueManager**: Fully implemented with sequential processing and retry logic
- **TokenQueueService**: Fully implemented with token approval and minting functionality
- **useTokenQueue Hook**: Implemented with React context for app-wide queue access
- **MintForm Component**: Implemented with full UI integration

All unit tests and integration tests are now passing. Some React act() warnings may appear in tests but do not affect functionality.

## Empty Error Objects from HashPack

### Symptom
Transactions return empty error objects (`{}`) or errors with no message when users close the HashPack wallet popup.

### Solution
The TransactionQueueManager implements improved error handling for these cases:

```typescript
try {
  // Attempt transaction
} catch (error) {
  // Check for empty error object from HashPack
  if (Object.keys(error).length === 0) {
    throw new Error(`Transaction was rejected or popup was closed`);
  }
  throw error;
}
```

If you're still seeing empty error objects, ensure you're using the latest version of the TokenQueueService and not bypassing it by calling wallet methods directly.

## Multiple Wallet Popups Appearing Simultaneously

### Symptom
Users report seeing multiple HashPack popups at once, causing confusion and potential transaction failures.

### Solution
The TransactionQueueManager processes transactions sequentially with configurable delays. Verify your configuration:

1. Check that you're not directly calling approval methods outside the queue system
2. Verify the delay settings are appropriate (default is 1000ms between transactions)
3. Ensure you're using the TokenQueueProvider in your React component tree

```typescript
// Adjust delay if needed
const queueManager = new TransactionQueueManager({
  connector: walletConnector,
  accountId: userAccountId,
  defaultDelayMs: 2000, // Increase delay if needed
});
```

## Transactions Not Being Processed

### Symptom
Transactions are enqueued but never processed, or the queue appears stuck.

### Solution
1. Check if the wallet connector is properly initialized:

```typescript
if (!connector) {
  console.error("Wallet connector not initialized");
  return;
}
```

2. Verify the queue is actively processing:

```typescript
const isActive = queueManager.isActive();
console.log("Queue active:", isActive);
```

3. Manually clean the queue if needed:

```typescript
queueManager.cleanQueue();
```

4. Check for any stuck transactions and their status:

```typescript
const stats = queueManager.getStats();
console.log("Queue stats:", stats);
```

## Dependencies Not Being Verified Correctly

### Symptom
Mint transactions are attempted before token approvals are completed.

### Solution
The TokenQueueService verifies dependencies before attempting dependent transactions. Check:

1. That approval transaction IDs are being stored correctly:

```typescript
// After queuing SAUCE approval
const sauceApprovalId = await tokenQueueService.queueTokenApproval({
  tokenType: 'SAUCE',
  amount: requiredAmount
});
// Make sure this ID is stored and returned correctly
```

2. Verify transaction statuses are being checked correctly:

```typescript
const sauceApprovalStatus = tokenQueueService.getTransaction(sauceApprovalId);
console.log("SAUCE approval status:", sauceApprovalStatus?.status);
```

## Race Conditions Between State Updates and Transaction Processing

### Symptom
React components are not updating correctly as transactions progress, or UI state is out of sync with actual transaction status.

### Solution
1. Use state polling to regularly check transaction status:

```tsx
useEffect(() => {
  if (!isProcessing) return;
  
  const intervalId = setInterval(() => {
    // Update state with latest transaction statuses
    setQueueStats(tokenQueueService.getQueueStats());
    
    // Check specific transaction status
    if (currentTxId) {
      const status = tokenQueueService.getTransaction(currentTxId);
      setCurrentStatus(status);
    }
  }, 1000);
  
  return () => clearInterval(intervalId);
}, [isProcessing, currentTxId]);
```

2. Use transaction callbacks for immediate updates:

```typescript
queueManager.enqueue({
  // ...other properties
  onSuccess: (result) => {
    // Update component state immediately
    setTransactionResult(result);
    setIsComplete(true);
  },
  onError: (error) => {
    setTransactionError(error);
    setHasFailed(true);
  }
});
```

## Transaction Result Type Handling

### Symptom
Type errors or runtime errors when handling the result of queueMintLynx due to inconsistent return types.

### Solution
The TokenQueueService returns an object with transaction IDs from queueMintLynx. Handle both possible return types:

```typescript
const result = await queueMintLynx({ lynxAmount });
if (typeof result === 'string') {
  // Handle string transaction ID (for backward compatibility)
  setMintTxId(result);
} else {
  // Handle object with multiple transaction IDs
  const { sauceApprovalId, clxyApprovalId, mintId } = result;
  // Store and track each transaction ID
}
```

## Transaction Retry Issues

### Symptom
Transactions are not being retried properly after failure, or are retrying too many times.

### Solution
1. Configure custom retry settings per transaction type:

```typescript
// For token approvals that often need more retries
tokenQueueService.queueTokenApproval({
  // ...other properties
  maxRetries: 3 // Override default retry count
});

// For mint operations that should fail fast
tokenQueueService.queueMintLynx({
  // ...other properties
  maxRetries: 1 // Only retry once
});
```

2. Add custom handling for specific failure types:

```typescript
queueManager.enqueue({
  // ...other properties
  createTransaction: async () => {
    try {
      // Attempt transaction
    } catch (error) {
      // Don't retry if user explicitly rejected
      if (error.message?.includes('User rejected')) {
        error.noRetry = true; // Signal that retry should be skipped
      }
      throw error;
    }
  }
});
```

## Testing Issues

### Symptom
Tests fail with "act" warnings from React, or mock functions are not called as expected.

### Solution
1. For "act" warnings in React tests:

```typescript
// Wrap state updates in act()
await act(async () => {
  fireEvent.click(mintButton);
  // Wait for promises to resolve
  await new Promise(resolve => setTimeout(resolve, 0));
});
```

2. For mock function issues, ensure you're mocking at the correct level:

```typescript
// Mock the TokenQueueService methods
const mockQueueMintLynx = jest.fn().mockResolvedValue({
  sauceApprovalId: 'sauce-tx-id',
  clxyApprovalId: 'clxy-tx-id',
  mintId: 'mint-tx-id'
});

// Apply the mock
jest.mock('../../app/hooks/useTokenQueue', () => ({
  useTokenQueue: () => ({
    queueMintLynx: mockQueueMintLynx,
    queueStats: { totalTransactions: 3, completedTransactions: 0 }
  })
}));
```

## Debug Logging

For persistent issues, enable debug logging:

```typescript
// In your TokenQueueService initialization
const tokenQueueService = new TokenQueueService({
  queueManager,
  connector,
  accountId,
  debug: true // Enable verbose logging
});

// Or manually log specific transactions
console.log('Queue stats:', tokenQueueService.getQueueStats());
console.log('SAUCE approval:', tokenQueueService.getTransaction('sauce-tx-id'));
console.log('CLXY approval:', tokenQueueService.getTransaction('clxy-tx-id'));
console.log('Mint status:', tokenQueueService.getTransaction('mint-tx-id'));
```

## Webpack and Module Issues

### Symptom
Missing modules like 'uuid' causing runtime errors.

### Solution
Ensure all required packages are properly installed:

```bash
# Install uuid and its type definitions
npm install uuid
npm install --save-dev @types/uuid
```

Add any missing type declarations for libraries:

```typescript
// In a declaration file (.d.ts)
declare module 'some-external-library';
```

## Common Error Messages and Their Meanings

| Error Message | Likely Cause | Solution |
|---------------|--------------|----------|
| "Wallet connector not initialized" | The wallet is not connected | Connect wallet before transaction |
| "Transaction was rejected or popup was closed" | User closed the HashPack popup | Inform user to complete all popups |
| "SAUCE token approval required" | Missing SAUCE approval before mint | Ensure SAUCE approval completes first |
| "CLXY token approval required" | Missing CLXY approval before mint | Ensure CLXY approval completes first |
| "SAUCE token approval failed" | SAUCE approval transaction failed | Check error details and retry |
| "Maximum retries exceeded" | Transaction failed after retry attempts | Check for persistent error causes |
| "User rejected transaction" | User explicitly clicked "Reject" | Inform user they need to approve |
| "Transaction underpriced" | Gas/fee issues | May need to adjust transaction parameters | 