// Script to transfer HBAR from Hedera account to the EVM address used for deployment
const { 
  Client, 
  AccountId, 
  PrivateKey, 
  TransferTransaction, 
  Hbar, 
  AccountBalanceQuery
} = require("@hashgraph/sdk");
require('dotenv').config({ path: '../.env.local' });

// Get the EVM address from the private key
function getEvmAddressFromPrivateKey(privateKeyString) {
  try {
    // Remove 0x prefix if present
    const keyString = privateKeyString.startsWith('0x') 
      ? privateKeyString.substring(2) 
      : privateKeyString;
      
    // Create a private key instance
    const privateKey = PrivateKey.fromStringECDSA(keyString);
    
    // Get the public key and then the EVM address
    const publicKey = privateKey.publicKey;
    const evmAddress = publicKey.toEvmAddress();
    
    return evmAddress;
  } catch (error) {
    console.error("Error getting EVM address:", error.message);
    return null;
  }
}

// Get Hedera account ID in EVM format (0x000...accountNum)
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
    
    // Amount to transfer
    const amountToTransfer = 50; // 50 HBAR
    
    // Get the EVM address from private key
    const evmAddress = getEvmAddressFromPrivateKey(operatorKey);
    if (!evmAddress) {
      console.error("ERROR: Could not derive EVM address from private key");
      process.exit(1);
    }
    
    console.log("Hedera account:", operatorId);
    console.log("EVM address derived from private key:", evmAddress);
    console.log("Transfer amount:", amountToTransfer, "HBAR");
    
    // Create Hedera client
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    // Check source account balance
    const balanceQuery = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(operatorId))
      .execute(client);
    
    const balance = balanceQuery.hbars;
    console.log(`Current balance: ${balance.toString()}`);
    
    if (parseFloat(balance.toString().replace(' ℏ', '')) < amountToTransfer) {
      console.error(`Insufficient funds. Have ${balance.toString()}, need at least ${amountToTransfer} HBAR`);
      process.exit(1);
    }
    
    // Create the transfer transaction
    console.log(`\nTransferring ${amountToTransfer} HBAR to EVM address...`);
    const transaction = new TransferTransaction()
      .addHbarTransfer(operatorId, new Hbar(-amountToTransfer))
      .addHbarTransfer(evmAddress, new Hbar(amountToTransfer))
      .setTransactionMemo("EVM address funding for deployment")
      .freezeWith(client);
    
    // Sign and execute the transaction
    const signedTx = await transaction.sign(PrivateKey.fromString(operatorKey));
    const txResponse = await signedTx.execute(client);
    
    // Get the receipt
    const receipt = await txResponse.getReceipt(client);
    console.log(`Transfer ${receipt.status.toString()}`);
    
    // Check new balances
    console.log("\nChecking new balances...");
    
    // Source account balance
    const newSourceBalance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(operatorId))
      .execute(client);
    console.log(`Source account (${operatorId}) balance: ${newSourceBalance.hbars.toString()}`);
    
    // Try to check destination balance, though this might not work directly for EVM addresses
    try {
      const evmAsAccountId = AccountId.fromEvmAddress(0, 0, evmAddress);
      const newDestBalance = await new AccountBalanceQuery()
        .setAccountId(evmAsAccountId)
        .execute(client);
      console.log(`Destination (${evmAddress}) balance: ${newDestBalance.hbars.toString()}`);
    } catch (error) {
      console.log(`Could not directly check EVM address balance: ${error.message}`);
      console.log("You'll need to verify the balance through the deployment process.");
    }
    
    console.log("\n✓ Transfer completed successfully!");
    console.log("You should now be able to proceed with deployment using Hardhat.");
    
  } catch (error) {
    console.error("Error during transfer:", error.message);
    process.exit(1);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 