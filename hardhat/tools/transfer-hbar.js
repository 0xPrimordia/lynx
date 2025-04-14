// Script to transfer HBAR from your Hedera account to your deploying wallet
const { Client, AccountId, PrivateKey, TransferTransaction, Hbar } = require("@hashgraph/sdk");
require('dotenv').config({ path: '../.env.local' });

// Helper to convert Hedera ID to EVM address
function hederaIdToEvmAddress(hederaId) {
  const parts = hederaId.split('.');
  if (parts.length < 3) return "Invalid Hedera ID format";
  
  const num = parts[2];
  const paddedNum = num.padStart(40, '0');
  return `0x${paddedNum}`;
}

async function main() {
  try {
    // Get credentials from environment variables
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      console.error("ERROR: Missing NEXT_PUBLIC_OPERATOR_ID or OPERATOR_KEY in .env.local file");
      process.exit(1);
    }
    
    console.log("Transferring from Hedera account:", operatorId);
    console.log("EVM address equivalent:", hederaIdToEvmAddress(operatorId));
    
    // Create Hedera client and set the operator
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    // Get the deployment address from Ethers wallet derived from the operator key
    // This matches how Hardhat creates the wallet for deployment
    const ethersWallet = require('ethers').Wallet.fromPrivateKey(Buffer.from(operatorKey, 'hex'));
    const deploymentAddress = ethersWallet.address;
    console.log("Deployment wallet address:", deploymentAddress);
    
    // Query the account balance
    const balanceQuery = await new (require('@hashgraph/sdk').AccountBalanceQuery)()
      .setAccountId(AccountId.fromString(operatorId))
      .execute(client);
    
    const balance = balanceQuery.hbars;
    console.log(`Current account balance: ${balance.toString()}`);
    
    // Amount to transfer (50 HBAR)
    const transferAmount = new Hbar(50);
    console.log(`Transferring ${transferAmount.toString()} to ${deploymentAddress}...`);
    
    // Create the transfer transaction
    const transaction = await new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(operatorId), transferAmount.negated())
      .addHbarTransfer(deploymentAddress, transferAmount)
      .setTransactionMemo("Funding deployment account")
      .execute(client);
    
    console.log(`Transaction ID: ${transaction.transactionId.toString()}`);
    
    // Get the receipt and check the status
    const receipt = await transaction.getReceipt(client);
    console.log(`Transfer status: ${receipt.status.toString()}`);
    
    console.log("\nTransfer complete! Please wait a few moments for the transfer to be finalized.");
    console.log("Now run the deployment script again.");
    
  } catch (error) {
    console.error("Error transferring HBAR:", error.message || error);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 