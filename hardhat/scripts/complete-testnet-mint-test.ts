import * as hre from "hardhat";
import { Client, AccountId, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, TokenInfoQuery, ContractId, Hbar, TokenMintTransaction } from "@hashgraph/sdk";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./.env.local" });

// Setup Hedera credentials
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
const operatorKey = process.env.OPERATOR_KEY || "";

if (!operatorId || !operatorKey) {
  throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
}

async function main() {
  console.log("FOCUSED TESTNET TOKEN VALIDATION");
  console.log("================================");
  console.log("Using Hedera account:", operatorId);
  
  try {
    // Step 1: Use a mock contract ID (we won't actually deploy it)
    console.log("\nStep 1: Setting up a mock contract ID for testing...");
    
    // Use a predefined contract ID for testing
    const contractIdString = "0.0.1679297187"; // A predefined contract ID
    const contractId = ContractId.fromString(contractIdString);
    
    console.log("Using contract ID:", contractIdString);
    console.log("This is a placeholder for a real contract");
    
    // Step 2: Create a token with the mock contract as supply key
    console.log("\nStep 2: Creating token with SDK and contract as supply key...");
    
    // Initialize Hedera client
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    // Create token with the contract as supply key
    const timestamp = new Date().getTime();
    const tokenCreateTx = new TokenCreateTransaction()
      .setTokenName(`Focused Test ${timestamp}`)
      .setTokenSymbol("FTEST")
      .setDecimals(0)
      .setInitialSupply(0)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(AccountId.fromString(operatorId))
      .setSupplyKey(contractId)
      .setMaxTransactionFee(new Hbar(30));
    
    // Submit the transaction
    console.log("Executing token creation transaction...");
    const txResponse = await tokenCreateTx.execute(client);
    
    // Get the receipt
    console.log("Waiting for receipt...");
    const receipt = await txResponse.getReceipt(client);
    
    // Get the token ID
    const tokenId = receipt.tokenId;
    
    if (!tokenId) {
      throw new Error("Failed to create token");
    }
    
    console.log("Token created with ID:", tokenId.toString());
    
    // Step 3: Verify token info and supply key
    console.log("\nStep 3: Verifying token supply key...");
    
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    
    console.log("Token name:", tokenInfo.name);
    console.log("Token symbol:", tokenInfo.symbol);
    console.log("Initial supply:", tokenInfo.totalSupply.toString());
    
    console.log("\nSupply key details:");
    console.log(JSON.stringify(tokenInfo.supplyKey, null, 2));
    
    const supplyKeyStr = tokenInfo.supplyKey ? tokenInfo.supplyKey.toString() : "null";
    console.log("Supply key string:", supplyKeyStr);
    console.log("Does it match our contract?", supplyKeyStr === contractIdString);
    
    if (supplyKeyStr !== contractIdString) {
      throw new Error("Supply key doesn't match the contract ID");
    }
    
    // Step 4: Try to mint with SDK directly (should fail)
    console.log("\nStep 4: Testing that SDK cannot mint directly...");
    
    let sdkMintFailed = false;
    try {
      console.log("Attempting to mint tokens with SDK (should fail)...");
      
      const sdkMintTx = await new TokenMintTransaction()
        .setTokenId(tokenId)
        .setAmount(100)
        .setMaxTransactionFee(new Hbar(20))
        .execute(client);
      
      await sdkMintTx.getReceipt(client);
      console.log("❌ SDK mint succeeded when it should have failed!");
    } catch (error) {
      console.log("✅ SDK mint failed as expected (contract has supply key)");
      sdkMintFailed = true;
    }
    
    if (!sdkMintFailed) {
      throw new Error("SDK mint should have failed but succeeded");
    }
    
    // Save results
    const results = {
      success: true,
      testType: "token creation and sdk mint failure",
      tokenId: tokenId.toString(),
      supplyKey: supplyKeyStr,
      initialSupply: tokenInfo.totalSupply.toString(),
      sdkMintFailed,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      "token-validation-results.json",
      JSON.stringify(results, null, 2)
    );
    
    console.log("\nResults saved to token-validation-results.json");
    console.log("\nTEST COMPLETED SUCCESSFULLY! ✅");
    console.log("\nNext steps would be to deploy a contract with the appropriate supply key and test minting");
    
  } catch (error) {
    console.error("Error:", error);
    console.log("\nTEST FAILED! ❌");
    
    // Save error to file
    fs.writeFileSync(
      "token-validation-error.json",
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }, null, 2)
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  }); 