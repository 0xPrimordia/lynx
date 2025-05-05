import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Client, AccountId, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, ContractId, Hbar } from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";

// Load environment variables
dotenv.config({ path: "../.env.local" });

// Get Hedera credentials from environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
const operatorKey = process.env.OPERATOR_KEY || "";

if (!operatorId || !operatorKey) {
  throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
}

// This is a simplified test that just creates a token via SDK
async function main() {
  console.log("Verifying Hybrid Solution Approach");
  console.log("==================================");

  // Initialize Hedera client
  const client = Client.forTestnet();
  
  try {
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    console.log("Creating token via Hedera SDK...");
    
    // Create a simple token just to verify SDK approach works
    const tokenCreateTx = new TokenCreateTransaction()
      .setTokenName("Hybrid Test Token")
      .setTokenSymbol("HTT")
      .setDecimals(0)
      .setInitialSupply(100)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(AccountId.fromString(operatorId))
      .setMaxTransactionFee(new Hbar(30))
      .freezeWith(client);
    
    const tokenCreateSubmit = await tokenCreateTx.execute(client);
    const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
    const tokenId = tokenCreateRx.tokenId;
    
    console.log("Token created successfully!");
    console.log("Token ID:", tokenId?.toString());
    
    // Save token info for reference
    const tokenInfo = {
      tokenId: tokenId?.toString(),
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      "hybrid-verify-token-info.json",
      JSON.stringify(tokenInfo, null, 2)
    );
    
    console.log("Token info saved to hybrid-verify-token-info.json");
    console.log("SDK-based token creation works successfully!");
    
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

// Run the verification
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 