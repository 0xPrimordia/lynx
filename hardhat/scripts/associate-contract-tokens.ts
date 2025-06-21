import { Client, AccountId, PrivateKey, TokenAssociateTransaction, TokenId, TransactionId, Hbar } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env.local" });

async function main() {
  console.log("🔗 Associating DepositMinter contract with tokens...");
  
  // Contract and token info
  const contractHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID;
  const lynxTokenId = "0.0.5948419";
  const sauceTokenId = "0.0.1183558"; 
  const clxyTokenId = "0.0.5365";
  
  if (!contractHederaId) {
    throw new Error("NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID environment variable not set");
  }
  
  console.log(`Contract ID: ${contractHederaId}`);
  console.log(`LYNX Token ID: ${lynxTokenId}`);
  console.log(`SAUCE Token ID: ${sauceTokenId}`);
  console.log(`CLXY Token ID: ${clxyTokenId}`);
  
  // Setup Hedera credentials - use the SAME account that deployed the contract
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
  const operatorKey = process.env.OPERATOR_KEY || "";

  if (!operatorId || !operatorKey) {
    throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
  }

  console.log(`Using operator account: ${operatorId}`);

  try {
    // Initialize Hedera client
    const client = Client.forTestnet();
    const privateKey = PrivateKey.fromString(operatorKey);
    const accountId = AccountId.fromString(operatorId);
    
    client.setOperator(accountId, privateKey);

    const tokenIds = [lynxTokenId, sauceTokenId, clxyTokenId];
    const tokenNames = ["LYNX", "SAUCE", "CLXY"];

    for (let i = 0; i < tokenIds.length; i++) {
      const tokenId = tokenIds[i];
      const tokenName = tokenNames[i];
      
      console.log(`\n🔗 Associating ${tokenName} token (${tokenId}) with contract...`);

      // Create token association transaction
      const associateTx = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(contractHederaId))
        .setTokenIds([TokenId.fromString(tokenId)])
        .setTransactionId(TransactionId.generate(accountId))
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(client);

      // Execute the transaction
      console.log(`📝 Executing ${tokenName} association transaction...`);
      const associateSubmit = await associateTx.execute(client);
      const associateRx = await associateSubmit.getReceipt(client);

      console.log(`✅ ${tokenName} token association completed!`);
      console.log(`Transaction ID: ${associateSubmit.transactionId?.toString()}`);
      console.log(`Status: ${associateRx.status.toString()}`);
    }

    console.log("\n🎉 SUCCESS!");
    console.log(`The DepositMinter contract is now associated with all required tokens.`);
    console.log(`The contract can now receive SAUCE and CLXY deposits and mint LYNX tokens.`);

    client.close();

  } catch (error) {
    console.error("❌ Error associating tokens:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 