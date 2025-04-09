# Token Approval Flow Guide

## Overview

This guide explains the process of minting LYNX tokens, which requires approving both SAUCE and CLXY tokens first. Our system now implements a sequential transaction queue to make this process smoother and more reliable.

## Implementation Status

The token approval flow has been fully implemented and integrated with the transaction queue system:

- **TokenQueueService**: Manages the sequence of token approvals and minting operations
- **useTokenQueue Hook**: Provides React components access to the queue functionality
- **MintForm Component**: User interface for the token approval and minting process
- **Sequential Processing**: Ensures wallet popups appear one at a time to avoid confusion

All implementations have been thoroughly tested and are working as expected.

## What's Happening When You Mint LYNX

Minting LYNX tokens involves multiple blockchain transactions that happen in sequence:

1. **SAUCE Token Approval**: Authorize the LYNX contract to use your SAUCE tokens
2. **CLXY Token Approval**: Authorize the LYNX contract to use your CLXY tokens
3. **LYNX Minting**: Create new LYNX tokens by spending your approved SAUCE and CLXY

Each step requires your wallet to confirm the transaction, so you'll see three separate wallet popups appear one after another.

## Step-by-Step Process

### 1. Enter the Amount to Mint

Enter how many LYNX tokens you want to mint in the input field. The system will automatically calculate how much SAUCE and CLXY you need.

![Mint Input Field](./images/mint-input.png)

### 2. Click "Mint LYNX"

Click the "Mint LYNX" button to start the process. This will trigger a sequence of blockchain transactions.

### 3. Approve SAUCE Tokens

The first wallet popup will ask you to approve the SAUCE tokens:

![SAUCE Approval](./images/sauce-approval.png)

**Important:** Wait for this transaction to complete before proceeding to the next step.

### 4. Approve CLXY Tokens

After the SAUCE approval completes, a second wallet popup will appear for CLXY approval:

![CLXY Approval](./images/clxy-approval.png)

**Important:** Wait for this transaction to complete before proceeding to the final step.

### 5. Confirm LYNX Minting

After both token approvals complete, a final wallet popup will appear to confirm the LYNX minting:

![LYNX Minting](./images/lynx-mint.png)

### 6. Transaction Complete

Once all transactions are confirmed, you'll see a success message and your LYNX balance will update.

## Progress Tracking

During the minting process, you'll see a progress indicator showing which step is currently active:

![Transaction Progress](./images/transaction-progress.png)

- **SAUCE Approval**: First step in the process
- **CLXY Approval**: Second step in the process
- **LYNX Minting**: Final step in the process

## Technical Implementation

The token approval flow is implemented in several key components:

### 1. TokenQueueService

```typescript
// Queue token approvals and mint transactions
const result = await tokenQueueService.queueMintLynx({
  lynxAmount: 10,
  onSuccess: (txId) => handleSuccess(txId),
  onError: (error) => handleError(error)
});

// Returns transaction IDs for tracking
// { sauceApprovalId, clxyApprovalId, mintId }
```

### 2. React Hook Integration

```typescript
// In a component using the useTokenQueue hook
const { queueMintLynx, queueStats } = useTokenQueue();

// Track queue progress
const progress = (queueStats.completedTransactions / queueStats.totalTransactions) * 100;
```

### 3. MintForm Component

The MintForm component provides a user interface for the minting process, showing the required tokens and transaction status.

## Troubleshooting

### Common Issues

#### Transaction Failed or Rejected

If you reject any transaction or if it fails for any reason, the process will stop. You'll need to start over by clicking "Mint LYNX" again.

**Tip:** Rejecting a transaction is not harmful - it simply cancels that step.

#### Wallet Popup Not Appearing

If a wallet popup doesn't appear:

1. Check if your wallet is locked or disconnected
2. Refresh the page and try again
3. Make sure popups are allowed in your browser

#### Previous Approvals

If you've previously approved SAUCE or CLXY tokens with a sufficient amount, the system will skip those approval steps and proceed to the next required transaction.

#### Insufficient Tokens

If you don't have enough SAUCE or CLXY tokens, the transaction will fail with an error message. Make sure you have the required amounts before trying again.

## Important Notes

- **One at a Time**: Only one popup will appear at a time to avoid confusion
- **Wait for Completion**: Each transaction must complete before the next one begins
- **Transaction Sequence**: The process always follows the same order: SAUCE → CLXY → LYNX
- **Cancellation**: You can cancel the process at any time by rejecting a transaction

## Need Help?

If you encounter any issues or have questions about the minting process, please contact our support team at support@lynxdao.io or join our Discord community for assistance. 