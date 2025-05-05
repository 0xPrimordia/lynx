import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  AccountBalanceQuery
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

async function main() {
  console.log("Testing token creation using Hedera SDK directly...");
  
  // Validate environment variables
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  if (!operatorId || !operatorKey) {
    throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be present");
  }
  
  console.log(`Using operator: ${operatorId}`);
  
  // Create Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  // Check account balance
  const balanceQuery = new AccountBalanceQuery()
    .setAccountId(AccountId.fromString(operatorId));
  
  const accountBalance = await balanceQuery.execute(client);
  console.log(`Account balance: ${accountBalance.hbars.toString()}`);
  
  // Create token
  console.log("\nCreating token with self as treasury:");
  console.log("- Name: Direct SDK Test");
  console.log("- Symbol: SDK");
  
  const adminKey = PrivateKey.fromString(operatorKey);
  const treasuryId = AccountId.fromString(operatorId);
  
  const transaction = new TokenCreateTransaction()
    .setTokenName("Direct SDK Test")
    .setTokenSymbol("SDK")
    .setTokenMemo("Test token created using SDK directly")
    .setDecimals(8)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryId)
    .setAdminKey(adminKey.publicKey)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyKey(adminKey.publicKey)
    .freezeWith(client);
  
  // Sign and execute the transaction
  const signedTx = await transaction.sign(adminKey);
  console.log("Transaction created and signed. Submitting...");
  
  const txResponse = await signedTx.execute(client);
  console.log(`Transaction ID: ${txResponse.transactionId}`);
  
  const receipt = await txResponse.getReceipt(client);
  console.log(`Status: ${receipt.status}`);
  
  if (receipt.tokenId) {
    console.log(`Token ID: ${receipt.tokenId.toString()}`);
    
    // Mint some tokens
    console.log("\nMinting 1000 tokens...");
    const mintTx = await new TokenMintTransaction()
      .setTokenId(receipt.tokenId)
      .setAmount(1000 * 10**8) // 1000 tokens with 8 decimal places
      .freezeWith(client)
      .sign(adminKey);
    
    const mintTxResponse = await mintTx.execute(client);
    const mintReceipt = await mintTxResponse.getReceipt(client);
    console.log(`Mint status: ${mintReceipt.status}`);
  }
}

main().catch(error => {
  console.error("Error in script:", error);
  process.exit(1);
}); 