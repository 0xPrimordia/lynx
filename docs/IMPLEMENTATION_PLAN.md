# LYNX Token Minting Implementation Plan

## Overview

This document outlines the focused implementation plan for fixing the LYNX token minting functionality to ensure real blockchain transactions are sent to the connected wallet instead of just being logged in the console.

## Current Issues (Updated)

Based on our investigation, we've identified these key issues:

1. **Transaction Flow Disconnect**: Despite having properly implemented TokenService and TransactionService, transactions aren't being properly sent to wallet. The queue logs show transactions being queued but no wallet popups appear.

2. **Protobuf Error in Balance Queries**: When trying to fetch token balances, we're getting the error: `Error: (BUG) body.data was not set in the protobuf`. This suggests compatibility issues between the HashPack wallet and our query implementation.

3. **Wallet Connection Issues**: The wallet appears to connect successfully (account ID 0.0.4372449 is shown in logs), but transactions aren't reaching it.

4. **Queue System Not Triggering Wallet**: The transaction queue system is executing but doesn't result in actual wallet popups.

## Revised Approach

Our revised approach will focus exclusively on fixing the transaction flow to ensure real blockchain transactions are sent to the wallet. We'll temporarily bypass balance checking since it's not critical to the core functionality.

### 1. Add Critical Transaction Logging

Add focused logging around the exact point where transactions are sent to the wallet to identify the breakdown:

```typescript
// In TransactionService.approveToken (or any method that calls signTransaction)
console.log('[CRITICAL] About to send transaction to wallet', {
  accountId: this.accountId,
  hasConnector: !!this.connector,
  hasSigner: !!signer,
  transactionType: 'approve',
  transactionDetails: {
    contractId: contractId,
    function: 'approve',
    tokenId: tokenId,
    amount: amount
  }
});

try {
  const signedTx = await signer.signTransaction(transaction);
  console.log('[CRITICAL] Transaction response from wallet', {
    success: !!signedTx,
    hasTransactionId: !!signedTx?.transactionId,
    transactionId: signedTx?.transactionId?.toString()
  });
  // Continue with success handling
} catch (error) {
  console.log('[CRITICAL] Error from wallet', {
    errorType: typeof error,
    errorKeys: error ? Object.keys(error) : [],
    errorMessage: error instanceof Error ? error.message : String(error)
  });
  // Continue with error handling
}
```

### 2. Validate Wallet Integration

Verify that the wallet connector is properly initialized and configured:

```typescript
// In WalletProvider.tsx after wallet connection
console.log('[CRITICAL] Wallet connection state', {
  accountId,
  connector: {
    initialized: !!dAppConnector,
    hasWalletConnectClient: !!dAppConnector?.walletConnectClient,
    sessionStatus: dAppConnector?.walletConnectClient?.session?.values ? 'has sessions' : 'no sessions'
  },
  signer: {
    available: !!dAppConnector?.getSigner(AccountId.fromString(accountId)),
    canSign: typeof dAppConnector?.getSigner(AccountId.fromString(accountId))?.signTransaction === 'function'
  }
});
```

### 3. Simplify Transaction Flow for Testing

Temporarily bypass the transaction queue to directly test basic transaction execution:

```typescript
// Simple direct test in mint page
const testDirectTransaction = async () => {
  if (!isConnected || !dAppConnector || !accountId) return;
  
  try {
    console.log('[TEST] Testing direct transaction execution');
    const signer = dAppConnector.getSigner(AccountId.fromString(accountId));
    
    // Create a simple transaction (e.g., a transfer of 0 HBAR to self)
    const transaction = new TransferTransaction()
      .addHbarTransfer(accountId, Hbar.fromTinybars(0))
      .addHbarTransfer(accountId, Hbar.fromTinybars(0));
    
    console.log('[TEST] About to send test transaction to wallet');
    const signedTx = await signer.signTransaction(transaction);
    console.log('[TEST] Test transaction successfully signed:', signedTx.transactionId.toString());
  } catch (error) {
    console.error('[TEST] Error executing test transaction:', error);
  }
};
```

### 4. Check for SDK Version Conflicts

Verify that we're using compatible versions of the SDK and wallet connector:

```bash
# Check package.json for all @hashgraph dependencies
grep -r "@hashgraph" package.json

# Make sure we're using compatible versions:
# - @hashgraph/sdk should be compatible with @hashgraph/hedera-wallet-connect
```

### 5. Verify Transaction Construction

Ensure transactions are being constructed properly for the HashPack wallet:

```typescript
// Verify transaction construction in TransactionService
const transaction = new ContractExecuteTransaction()
  .setContractId(ContractId.fromString(contractId))
  .setGas(3000000)
  .setFunction(
    "approve", 
    new ContractFunctionParameters()
      .addAddress(tokenAddress)
      .addUint256(Number(amount))
  );

// Log the transaction object to see its structure
console.log('[DEBUG] Transaction structure:', {
  contractId: transaction.contractId?.toString(),
  gas: transaction._gas?.toString(),
  functionName: transaction._functionParameters?.functionName,
  paramCount: transaction._functionParameters?.parameters?.length
});
```

### 6. Trace TokenQueueService Flow

Add detailed trace logging to follow the exact flow through the TokenQueueService:

```typescript
// In TokenQueueService.queueTokenApproval
console.log('[TRACE] Starting token approval queue process', {
  tokenType,
  amount,
  tokenId,
  contractId
});

// Later, in the enqueued transaction
console.log('[TRACE] Executing queued transaction', {
  id: transactionId,
  name: `${tokenName} Approval`,
  attempt: tx.attempts
});

// After transaction execution
console.log('[TRACE] Transaction execution completed', {
  id: transactionId,
  result: result
});
```

## Testing Strategy

1. **Direct Transaction Test**
   - Implement a simple direct transaction test (bypassing queue) to confirm basic wallet interaction
   - Verify if HashPack wallet popup appears for the test transaction
   - This will confirm if the issue is in the queue system or in the wallet integration

2. **Transaction Queue Trace**
   - Add trace logging throughout the queue system
   - Monitor execution flow from queue creation to transaction execution
   - Identify where the breakdown occurs in the queue processing

3. **Wallet Integration Verification**
   - Confirm the wallet is properly connected and the signer is available
   - Verify the wallet can sign a basic transaction
   - Check compatibility between HashPack wallet and our SDK versions

## Success Criteria

1. Wallet popup appears when executing a test transaction
2. Full trace logs show the complete flow of a transaction through the system
3. Identification of the exact point where transactions are failing to reach the wallet
4. After fixing: SAUCE approval, CLXY approval, and LYNX mint transactions successfully trigger wallet popups

## Next Steps

1. Implement critical transaction logging
2. Test direct transaction execution
3. Based on findings, fix the identified issues
4. Re-enable the queue system once basic transaction execution is confirmed
5. After transaction flow is fixed, address the balance query issues

## References

- [TOKEN_APPROVAL_FLOW.md](./TOKEN_APPROVAL_FLOW.md) - Details on the token approval flow
- [TRANSACTION_QUEUE.md](./TRANSACTION_QUEUE.md) - Information about the transaction queue system
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions 