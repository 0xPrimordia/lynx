import { Client, AccountId, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, TokenInfoQuery, ContractId, Hbar } from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables - use the correct path
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

// Setup Hedera credentials
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
const operatorKey = process.env.OPERATOR_KEY || "";

if (!operatorId || !operatorKey) {
  throw new Error(`Environment variables not found. Tried loading from: ${envPath}`);
}

async function main() {
  console.log("SUPPLY KEY VERIFICATION TEST");
  console.log("============================");
  console.log("Using Hedera account:", operatorId);
  
  // Step 1: Use fixed contract address - from previous test results
  // This is the SimpleTokenMinter address from hybrid-approach-test-results.json
  const contractAddress = "0x0000000000000000000000000000000000197e73";
  console.log("Using contract address:", contractAddress);
  
  // Step 2: Convert contract address to Hedera format correctly
  console.log("\nStep 2: Converting contract address to Hedera format...");
  
  // Parse the contract address from hex to decimal
  const contractEntityNum = parseInt(contractAddress.slice(2), 16);
  const contractIdStr = `0.0.${contractEntityNum}`;
  
  console.log("Contract ID in Hedera format:", contractIdStr);
  console.log("Original EVM address:", contractAddress);
  
  // Create a ContractId object
  const contractId = ContractId.fromString(contractIdStr);
  
  // Step 3: Create token via SDK with contract as supply key
  console.log("\nStep 3: Creating token via Hedera SDK...");
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  
  // Use the appropriate method to create the PrivateKey
  let privateKey;
  try {
    if (operatorKey.startsWith("302e")) {
      // DER format
      privateKey = PrivateKey.fromStringDer(operatorKey);
    } else if (operatorKey.length === 64 || operatorKey.length === 66) {
      // Raw hex format (possibly with 0x prefix)
      privateKey = PrivateKey.fromStringECDSA(operatorKey);
    } else {
      // Generic format - last resort
      privateKey = PrivateKey.fromString(operatorKey);
    }
  } catch (e) {
    console.log("Error parsing private key, trying generic format:", e);
    privateKey = PrivateKey.fromString(operatorKey);
  }
  
  client.setOperator(
    AccountId.fromString(operatorId),
    privateKey
  );
  
  // Create token with the contract as the supply key
  try {
    const tokenCreateTx = new TokenCreateTransaction()
      .setTokenName("Supply Key Test Token")
      .setTokenSymbol("SKTT")
      .setDecimals(0)
      .setInitialSupply(0)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(AccountId.fromString(operatorId))
      .setSupplyKey(contractId) // Using ContractId directly as supply key
      .setMaxTransactionFee(new Hbar(30))
      .freezeWith(client);
    
    console.log("Transaction frozen, executing...");
    const tokenCreateSubmit = await tokenCreateTx.execute(client);
    console.log("Transaction executed, waiting for receipt...");
    const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
    const tokenId = tokenCreateRx.tokenId;
    
    if (!tokenId) {
      throw new Error("Failed to create token - no token ID returned");
    }
    
    console.log("Token created successfully!");
    console.log("Token ID:", tokenId.toString());
    
    // Step 4: Get token info to verify supply key
    console.log("\nStep 4: Verifying token supply key...");
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    
    // Extract supply key details
    const supplyKey = tokenInfo.supplyKey;
    console.log("Raw Supply Key Data:", JSON.stringify(supplyKey, null, 2));
    
    // Parse the supply key to verify it matches our contract
    const supplyKeyObj = JSON.parse(JSON.stringify(supplyKey));
    if (supplyKeyObj && supplyKeyObj.contractId) {
      const supplyKeyContractId = supplyKeyObj.contractId.toString();
      console.log("Supply key contract ID:", supplyKeyContractId);
      console.log("Does it match our contract?", supplyKeyContractId === contractIdStr);
      
      if (supplyKeyContractId === contractIdStr) {
        console.log("\n✅ VERIFICATION SUCCESSFUL: Contract was correctly set as the supply key!");
        console.log("This confirms the hybrid approach is viable for setting a contract as the supply key.");
        
        // Save the results
        const results = {
          success: true,
          contractAddress,
          contractIdHedera: contractIdStr, 
          tokenId: tokenId.toString(),
          supplyKey: supplyKeyContractId,
          timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync(
          "supply-key-verification.json",
          JSON.stringify(results, null, 2)
        );
        console.log("\nResults saved to supply-key-verification.json");
      } else {
        console.log("\n❌ VERIFICATION FAILED: Supply key doesn't match the contract ID");
      }
    } else if (supplyKeyObj && supplyKeyObj.num) {
      // Older SDK version might use a different format
      const supplyKeyContractId = `0.0.${supplyKeyObj.num.low}`;
      console.log("Supply key contract ID (alt format):", supplyKeyContractId);
      console.log("Does it match our contract?", supplyKeyContractId === contractIdStr);
      
      if (supplyKeyContractId === contractIdStr) {
        console.log("\n✅ VERIFICATION SUCCESSFUL: Contract was correctly set as the supply key!");
        console.log("This confirms the hybrid approach is viable for setting a contract as the supply key.");
      } else {
        console.log("\n❌ VERIFICATION FAILED: Supply key doesn't match the contract ID");
      }
    } else {
      console.log("\n❌ VERIFICATION FAILED: Could not parse supply key data");
      console.log("Supply key data:", JSON.stringify(supplyKey));
    }
  } catch (error) {
    console.error("Error during token creation:", error);
  }
  
  console.log("\nTest complete");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 