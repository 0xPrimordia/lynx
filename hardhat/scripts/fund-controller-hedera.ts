import { TransferTransaction, TokenId, Hbar, ContractId, AccountId, AccountBalanceQuery, PrivateKey } from '@hashgraph/sdk';
import { createHederaClient, getDeploymentInfo } from './utils/hedera-helpers';

async function main() {
  try {
    console.log('Starting controller funding process using Hedera SDK...');
    
    // Create Hedera client
    const client = createHederaClient();
    
    // Get controller ID from deployment info
    const { controllerId } = getDeploymentInfo();
    console.log(`Controller ID: ${controllerId}`);
    
    if (!controllerId || controllerId === '0.0.0') {
      throw new Error('Controller ID not found in deployment info. Please deploy the controller first.');
    }
    
    // Convert to ContractId and AccountId
    const contractId = ContractId.fromString(controllerId);
    const accountId = AccountId.fromString(controllerId);
    
    // Check current balance
    const balanceQuery = new AccountBalanceQuery().setAccountId(accountId);
    const balance = await balanceQuery.execute(client);
    console.log(`Current contract balance: ${balance.hbars.toString()}`);
    
    // Define amount to transfer (5 HBAR)
    const amount = new Hbar(5);
    console.log(`Funding contract with ${amount.toString()}`);
    
    // Create transfer transaction
    const transaction = new TransferTransaction()
      .addHbarTransfer(client.operatorAccountId!, amount.negated())
      .addHbarTransfer(accountId, amount)
      .setTransactionMemo('Fund controller contract')
      .setMaxTransactionFee(new Hbar(2))
      .freezeWith(client);
    
    // Sign and execute
    // We need to get the signing key from the client's configuration
    const operatorKey = process.env.HEDERA_PRIVATE_KEY!;
    const signedTx = await transaction.sign(PrivateKey.fromString(operatorKey));
    const response = await signedTx.execute(client);
    
    // Get receipt
    const receipt = await response.getReceipt(client);
    console.log(`Transaction status: ${receipt.status.toString()}`);
    console.log(`Transaction ID: ${response.transactionId.toString()}`);
    
    // Check new balance
    const newBalanceQuery = new AccountBalanceQuery().setAccountId(accountId);
    const newBalance = await newBalanceQuery.execute(client);
    console.log(`New contract balance: ${newBalance.hbars.toString()}`);
    
    console.log('Successfully funded the controller contract');
  } catch (error) {
    console.error('Error funding controller contract:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 