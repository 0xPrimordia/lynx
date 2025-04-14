import {
  Client,
  AccountId,
  PrivateKey,
  TransferTransaction,
  Hbar,
  AccountBalanceQuery
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

// Helper function to get deployment info
function getDeploymentInfo(): any {
  const deploymentInfoPath = path.join(__dirname, "../../../deployment-info.json");
  return require(deploymentInfoPath);
}

// Validate environment variables
function validateEnv() {
  const requiredEnvVars = ["NEXT_PUBLIC_OPERATOR_ID", "OPERATOR_KEY"];
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  
  return {
    operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID || "",
    operatorKey: process.env.OPERATOR_KEY || "",
  };
}

async function main() {
  try {
    console.log("Starting vault funding with Hedera SDK...");
    
    // Validate environment
    const { operatorId, operatorKey } = validateEnv();
    console.log(`Using operator: ${operatorId}`);
    
    // Initialize Hedera client
    const client = Client.forTestnet();
    console.log("Initialized Hedera testnet client");
    
    // Set up client operator account
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    console.log("Set operator account for client");
    
    // Get deployment info
    const deploymentInfo = getDeploymentInfo();
    const vaultId = deploymentInfo.vaultId;
    console.log(`Vault ID: ${vaultId}`);
    
    // Check current balance of vault
    console.log(`Checking current balance of vault ${vaultId}...`);
    const vaultBalance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(vaultId))
      .execute(client);
    
    console.log(`Current balance: ${vaultBalance.hbars.toString()}`);
    
    // Amount to fund (5 HBAR)
    const fundAmount = new Hbar(5);
    console.log(`Funding amount: ${fundAmount.toString()}`);
    
    // Transfer HBAR to vault
    console.log("Creating transfer transaction...");
    const transferTx = new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(operatorId), fundAmount.negated())
      .addHbarTransfer(AccountId.fromString(vaultId), fundAmount)
      .setTransactionMemo("Funding vault for token creation")
      .setMaxTransactionFee(new Hbar(2));
    
    // Execute transaction
    console.log("Submitting transaction...");
    const submitTx = await transferTx.execute(client);
    console.log(`Transaction ID: ${submitTx.transactionId.toString()}`);
    
    // Get receipt
    const receipt = await submitTx.getReceipt(client);
    console.log(`Transaction status: ${receipt.status.toString()}`);
    
    // Check new balance
    console.log("Checking new balance...");
    const newBalance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(vaultId))
      .execute(client);
    
    console.log(`New balance: ${newBalance.hbars.toString()}`);
    console.log("Funding complete");
    
  } catch (error) {
    console.error("Error in vault funding process:", error);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 