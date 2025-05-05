import { Client, AccountId, PrivateKey, TokenInfoQuery } from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

// Setup Hedera credentials 
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
const operatorKey = process.env.OPERATOR_KEY || "";

if (!operatorId || !operatorKey) {
  throw new Error(`Environment variables not found. Tried loading from: ${envPath}`);
}

// Read test results to get existing token ID
let tokenId = "0.0.5939528"; // From definitive-test-results.json
let contractIdStr = "0.0.1679297187"; // From definitive-test-results.json

async function main() {
  console.log("SUPPLY KEY VERIFICATION ON EXISTING TOKEN");
  console.log("=========================================");
  console.log("Using Hedera account:", operatorId);
  console.log("Looking up token:", tokenId);
  console.log("Expected contract ID:", contractIdStr);

  try {
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
    
    // Get token info to verify supply key
    console.log("\nChecking token info and supply key...");
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    
    console.log("Token name:", tokenInfo.name);
    console.log("Token symbol:", tokenInfo.symbol);
    console.log("Total supply:", tokenInfo.totalSupply.toString());
    
    // Extract supply key details
    const supplyKey = tokenInfo.supplyKey;
    console.log("\nRaw Supply Key Data:", JSON.stringify(supplyKey, null, 2));
    
    // Parse the supply key and check if it matches
    const supplyKeyObj = JSON.parse(JSON.stringify(supplyKey));
    
    let supplyKeyContractId;
    let keyMatchesContract = false;
    
    if (supplyKeyObj && supplyKeyObj.contractId) {
      supplyKeyContractId = supplyKeyObj.contractId.toString();
      keyMatchesContract = supplyKeyContractId === contractIdStr;
    } else if (supplyKeyObj && supplyKeyObj.num) {
      supplyKeyContractId = `0.0.${supplyKeyObj.num.low}`;
      keyMatchesContract = supplyKeyContractId === contractIdStr;
    } else if (supplyKeyObj && typeof supplyKeyObj === 'object') {
      // Try to extract contract ID from various possible formats
      console.log("Supply key is in an unknown format, attempting to parse...");
      for (const key in supplyKeyObj) {
        console.log(`Key property: ${key} = ${JSON.stringify(supplyKeyObj[key])}`);
      }
    } else {
      console.log("Supply key is in an unexpected format");
    }
    
    if (supplyKeyContractId) {
      console.log("Supply key contract ID:", supplyKeyContractId);
      console.log("Does it match expected contract?", keyMatchesContract);
      
      if (keyMatchesContract) {
        console.log("\n✅ VERIFICATION SUCCESSFUL: Contract is correctly set as the supply key!");
        console.log("This confirms the hybrid approach is viable for setting a contract as the supply key.");
        
        // Save the results
        const results = {
          success: true,
          contractIdHedera: contractIdStr, 
          tokenId: tokenId,
          supplyKey: supplyKeyContractId,
          timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync(
          "supply-key-verification.json",
          JSON.stringify(results, null, 2)
        );
        console.log("\nResults saved to supply-key-verification.json");
      } else {
        console.log("\n❌ VERIFICATION FAILED: Supply key doesn't match the expected contract ID");
      }
    } else {
      console.log("\n❌ VERIFICATION FAILED: Could not extract contract ID from supply key");
    }
  } catch (error) {
    console.error("Error checking token:", error);
  }
  
  console.log("\nVerification complete");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 