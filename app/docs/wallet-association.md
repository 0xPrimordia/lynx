# Extension Wallet Token Association Flow

## Overview

This document explains how token association is handled for extension wallets in Hedera applications. The key insight is that **token association is handled on the client-side** for extension wallets, with the server providing transaction preparation and association checking services.

## Architecture Summary

- **Server-Side**: Transaction preparation, association checking, and transaction creation
- **Client-Side**: Transaction signing, execution, and proactive association requests
- **Key Principle**: Extension wallets maintain full control over transaction signing while actively managing association requirements

## Why Token Association is Necessary

In Hedera, before any account can receive or interact with a token, it must be "associated" with that token. This is a one-time operation that establishes the relationship between the account and the token.

## Server-Side Components

### 1. Association Check API (`/api/check-association`)

**Purpose**: Determines if a user's account is already associated with a specific token.

```typescript
// Server-side implementation
export async function POST(req: Request) {
    const { accountId } = await req.json();
    
    // Query Hedera mirror node to check token relationships
    const url = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${process.env.TOKEN_ID}`;
    const response = await fetch(url);
    const data = await response.json();
    
    // If tokens array is empty, the account is not associated
    const isAssociated = data.tokens && data.tokens.length > 0;
    
    return NextResponse.json({ 
        isAssociated,
        tokenId: process.env.TOKEN_ID
    });
}
```

**Key Points**:
- Uses Hedera mirror node API for association checking
- No transaction creation or signing
- Pure read-only operation

### 2. Token Association Transaction Creation

**Purpose**: Creates unsigned `TokenAssociateTransaction` objects for extension wallets.

```typescript
// Server-side transaction creation (NOT frozen for extension wallets)
const associateTransaction = new TokenAssociateTransaction()
    .setAccountId(senderAccountId)
    .setTokenIds([tokenId])
    .setTransactionId(TransactionId.generate(senderAccountId))
    .setMaxTransactionFee(new Hbar(10));

// CRITICAL: DO NOT FREEZE for extension wallets
console.log('Creating unfrozen association transaction for extension wallet');
```

**Key Points**:
- Transactions are **NOT frozen** for extension wallets
- Allows extension wallet to sign the transaction
- Higher transaction fees for reliability

### 3. Utility Functions (`src/app/lib/utils/tokens.ts`)

**Purpose**: Provides reusable functions for association checking and transaction creation.

```typescript
// Check if account is associated with token
export const checkTokenAssociation = async (accountId: string, tokenId: string) => {
    const response = await fetch(
        `https://${process.env.NEXT_PUBLIC_HEDERA_NETWORK}.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`
    );
    const data = await response.json();
    return data.tokens && data.tokens.length > 0;
};

// Create association transaction (unfrozen)
export const associateToken = async (accountId: string, tokenId: string) => {
    const transaction = await new TokenAssociateTransaction()
        .setAccountId(accountId)
        .setTokenIds([tokenId])
        .setTransactionId(TransactionId.generate(accountId));

    return transactionToBase64String(transaction);
};
```

## Client-Side Components

### 1. Extension Wallet Transaction Handler

**Purpose**: Handles the execution of transactions through extension wallets.

```typescript
// src/app/lib/transactions/extensionWallet.ts
export const handleExtensionTransaction = async (
    tx: string,
    account: string,
    signAndExecuteTransaction: (params: SignAndExecuteTransactionParams) => Promise<any>
) => {
    // Simple pass-through implementation
    return signAndExecuteTransaction({
        transactionList: tx,
        signerAccountId: account
    });
};
```

**Key Points**:
- Simple pass-through to extension wallet
- No transaction modification
- Extension wallet handles all signing

### 2. Proactive Association Management

**Purpose**: The client actively checks for and requests token associations when needed.

```typescript
// Client-side association check and execution
const handleTokenOperation = async () => {
    let transactions: string[] = [];
    
    // PROACTIVE: Check if tokens need association before any operation
    if (!await checkTokenAssociation(activeAccount, tokenId)) {
        console.log('Token association required, creating association transaction');
        transactions.push(await associateToken(activeAccount, tokenId));
    }

    // Execute association transaction first if needed
    for (const tx of transactions) {
        await executeTransaction(tx, "Token Association");
    }
    
    // Proceed with the actual operation (swap, transfer, etc.)
    const operationTx = await createOperationTransaction();
    await executeTransaction(operationTx, "Token Operation");
};

const executeTransaction = async (tx: string, description: string) => {
    return handleExtensionTransaction(tx, account, signAndExecuteTransaction);
};
```

## Complete Flow Example

### 1. User Initiates Any Token Operation

```typescript
// User clicks any button that requires token interaction
const handleUserAction = async () => {
    // 1. CLIENT PROACTIVELY checks if association is needed
    const needsAssociation = !await checkTokenAssociation(account, tokenId);
    
    if (needsAssociation) {
        console.log('Association required, requesting association transaction');
        
        // 2. CLIENT requests association transaction from server
        const associateTx = await associateToken(account, tokenId);
        
        // 3. CLIENT executes association through extension wallet
        await handleExtensionTransaction(associateTx, account, signAndExecuteTransaction);
        
        console.log('Association completed, proceeding with operation');
    }
    
    // 4. Proceed with the intended operation
    const operationTx = await createOperationTransaction();
    await handleExtensionTransaction(operationTx, account, signAndExecuteTransaction);
};
```

### 2. DEX Trading Flow

```typescript
// Client-side trading with automatic association handling
const handleSwap = async () => {
    let transactions: string[] = [];
    
    // CLIENT checks associations based on trade type
    switch (getTradeType()) {
        case 'hbarToToken':
            if (!await checkTokenAssociation(activeAccount, tradeToken.id)) {
                transactions.push(await associateToken(activeAccount, tradeToken.id));
            }
            break;
        case 'tokenToToken':
            if (!await checkTokenAssociation(activeAccount, currentToken.id)) {
                transactions.push(await associateToken(activeAccount, currentToken.id));
            }
            if (!await checkTokenAssociation(activeAccount, tradeToken.id)) {
                transactions.push(await associateToken(activeAccount, tradeToken.id));
            }
            break;
    }

    // CLIENT executes association transactions first
    for (const tx of transactions) {
        await executeTransaction(tx, "Token Association");
    }
    
    // Then execute the swap transaction
    const swapTx = await createSwapTransaction();
    await executeTransaction(swapTx, "Token Swap");
};
```

### 3. NFT Purchase Flow

```typescript
// Client-side NFT purchase with association handling
const handleNFTPurchase = async () => {
    // CLIENT checks if NFT token needs association
    if (!await checkTokenAssociation(account, nftTokenId)) {
        console.log('NFT token association required');
        
        // CLIENT requests association transaction
        const associateTx = await associateToken(account, nftTokenId);
        
        // CLIENT executes association
        await handleExtensionTransaction(associateTx, account, signAndExecuteTransaction);
    }
    
    // Proceed with NFT purchase
    const purchaseTx = await createNFTPurchaseTransaction();
    await handleExtensionTransaction(purchaseTx, account, signAndExecuteTransaction);
};
```

## Key Architectural Principles

### 1. Client-Side Proactivity
- **Client initiates association checks** before any token operation
- **Client requests association transactions** when needed
- **Client manages the association flow** as part of user operations

### 2. Server-Side Support
- **Server provides association checking** via mirror node queries
- **Server creates unfrozen transactions** for client signing
- **Server never signs transactions** for extension wallets

### 3. Extension Wallet Control
- **Extension wallet signs all transactions**
- **Extension wallet executes all transactions**
- **Users maintain full control** over their private keys

## Security Considerations

### 1. Extension Wallet Security
- **Private Key Control**: Users maintain full control over their private keys
- **Transaction Signing**: All transactions are signed by the user's extension wallet
- **No Server Access**: Server never has access to user private keys

### 2. Transaction Integrity
- **Unfrozen Transactions**: Extension wallets receive unfrozen transactions for signing
- **User Verification**: Users can review transaction details before signing
- **Direct Execution**: Transactions are executed directly by the extension wallet

### 3. Association Security
- **One-Time Operation**: Token association is a one-time operation per token
- **Irreversible**: Once associated, the relationship cannot be easily removed
- **Gas Costs**: Association operations have associated gas costs

## Implementation Requirements

### Server-Side Requirements
1. **Association Checking**: Mirror node API integration
2. **Transaction Creation**: Unfrozen `TokenAssociateTransaction` objects
3. **Environment Variables**: Token IDs and network configuration
4. **Error Handling**: Proper error responses for failed operations

### Client-Side Requirements
1. **Extension Wallet Integration**: `@hashgraph/hedera-wallet-connect`
2. **Transaction Execution**: `signAndExecuteTransaction` function
3. **Association Checking**: Client-side utility functions
4. **Proactive Management**: Association checking before operations
5. **Error Handling**: User-friendly error messages

### Dependencies
```json
{
  "@hashgraph/sdk": "^2.x.x",
  "@hashgraph/hedera-wallet-connect": "^1.x.x"
}
```

## Best Practices

### 1. Proactive Association Management
- **Check association status** before any token operation
- **Request association transactions** when needed
- **Execute associations first** before proceeding with operations

### 2. Transaction Preparation
- **Use appropriate transaction fees** for association operations
- **Handle both testnet and mainnet** environments
- **Provide clear transaction descriptions** for user approval

### 3. Error Handling
- **Implement proper error handling** for association failures
- **Provide clear user feedback** for failed operations
- **Log association attempts** for debugging

### 4. User Experience
- **Automatically handle association** when needed
- **Provide clear progress indicators** during association
- **Minimize user interaction** for association flows
- **Explain association requirements** to users

### 5. Performance
- **Cache association status** when possible
- **Batch association checks** for multiple tokens
- **Use efficient mirror node queries**

## Common Use Cases

### 1. Token Swapping
- Check association for both input and output tokens
- Associate tokens before executing swap
- Handle approval transactions after association

### 2. Token Transfers
- Check association for recipient account
- Associate tokens before transfer
- Handle failed associations gracefully

### 3. NFT Operations
- Check association for NFT token
- Associate NFT token before minting/purchasing
- Handle collection-level associations

### 4. DeFi Operations
- Check association for all involved tokens
- Associate tokens before staking/lending
- Handle complex multi-token operations

## Conclusion

The extension wallet token association flow is **primarily client-side** with server-side support. The client:

1. **Proactively checks** for association requirements
2. **Requests association transactions** from the server when needed
3. **Executes associations** through the extension wallet
4. **Manages the complete flow** as part of user operations

This architecture ensures that extension wallet users maintain full control over their transactions while providing a seamless user experience for token association operations across all use cases. 