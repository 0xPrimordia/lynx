import { Client, AccountId, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, TokenInfoQuery, ContractId, Hbar } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Load environment variables from the correct location
dotenv.config({ path: "./.env.local" });

// Get the environment variables - using the CORRECT names
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
const operatorKey = process.env.OPERATOR_KEY || "";

// Log env vars to debug - not showing the full key for security
console.log("Environment variables loaded:");
console.log("NEXT_PUBLIC_OPERATOR_ID:", operatorId);
console.log("OPERATOR_KEY (first 4 chars):", operatorKey ? operatorKey.substring(0, 4) : "undefined");

if (!operatorId || !operatorKey) {
  throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
}

async function main() {
  console.log("\nBASIC SUPPLY KEY TEST");
  console.log("====================");
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  
  // Set the operator using the exact correct variable names
  // No fancy handling, just direct usage of the environment variables
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  // Create a fake contract ID for testing
  const contractIdStr = "0.0.12345"; // Doesn't matter for this test
  const contractId = ContractId.fromString(contractIdStr);
  
  // Step 1: Create a simple token
  console.log("\nStep 1: Creating token with contract as supply key...");
  
  try {
    const transaction = new TokenCreateTransaction()
      .setTokenName("Basic Supply Key Test")
      .setTokenSymbol("BSK")
      .setDecimals(0)
      .setInitialSupply(0)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(AccountId.fromString(operatorId))
      .setSupplyKey(contractId)
      .setMaxTransactionFee(new Hbar(30));
    
    // Submit the transaction
    const txResponse = await transaction.execute(client);
    
    // Get the receipt
    const receipt = await txResponse.getReceipt(client);
    
    // Get the token ID
    const tokenId = receipt.tokenId;
    
    if (!tokenId) {
      throw new Error("Failed to create token");
    }
    
    console.log(`Token created with ID: ${tokenId}`);
    
    // Query token info to verify the supply key
    console.log("\nStep 2: Verifying supply key...");
    
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    
    console.log("Token name:", tokenInfo.name);
    console.log("Token symbol:", tokenInfo.symbol);
    
    // Supply key verification
    console.log("\nSupply key details (raw):");
    console.log(JSON.stringify(tokenInfo.supplyKey, null, 2));
    
    const supplyKeyStr = tokenInfo.supplyKey ? tokenInfo.supplyKey.toString() : "null";
    console.log(`Supply key string: ${supplyKeyStr}`);
    
    // Check if the supply key matches our contract ID
    if (supplyKeyStr.includes(contractIdStr)) {
      console.log("\n✅ VERIFICATION SUCCESSFUL: Contract was set as the supply key");
      console.log("This confirms the hybrid approach is viable");
    } else {
      console.log("\n❌ VERIFICATION FAILED: Supply key doesn't match the contract ID");
      console.log("Expected:", contractIdStr);
      console.log("Got:", supplyKeyStr);
    }
  } catch (error) {
    console.error("Transaction failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("ERROR:", error);
    process.exit(1);
  }); 