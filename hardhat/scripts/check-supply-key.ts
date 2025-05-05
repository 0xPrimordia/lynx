import { Client, AccountId, PrivateKey, TokenInfoQuery, ContractId } from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";

// Load environment variables
dotenv.config({ path: "./.env.local" });

// Setup Hedera credentials
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
const operatorKey = process.env.OPERATOR_KEY || "";

if (!operatorId || !operatorKey) {
  throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
}

async function main() {
  // Check if results file exists
  if (!fs.existsSync("hybrid-approach-test-results.json")) {
    console.error("No test results found. Please run hybrid-token-mint-test.ts first.");
    process.exit(1);
  }

  // Read the token info from the test results
  const testResults = JSON.parse(fs.readFileSync("hybrid-approach-test-results.json", "utf8"));
  const { tokenId, contractIdHedera } = testResults;

  console.log("Checking supply key for token:", tokenId);
  console.log("Expected contract with supply key:", contractIdHedera);

  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );

  // Get token info
  const tokenInfo = await new TokenInfoQuery()
    .setTokenId(tokenId)
    .execute(client);

  console.log("\nToken Info:");
  console.log("- Name:", tokenInfo.name);
  console.log("- Symbol:", tokenInfo.symbol);
  console.log("- Total Supply:", tokenInfo.totalSupply.toString());
  
  // Check supply key
  const supplyKey = tokenInfo.supplyKey;
  console.log("\nSupply Key Details:");
  
  if (supplyKey) {
    console.log("Supply key is set");
    console.log("Supply key type:", typeof supplyKey);
    console.log("Supply key:", JSON.stringify(supplyKey, null, 2));
    
    try {
      // Try to access key information in a more generic way
      const keyJSON = JSON.stringify(supplyKey);
      console.log("Does the key contain our contract ID?", keyJSON.includes(contractIdHedera));
    } catch (error) {
      console.error("Error checking key:", error);
    }
  } else {
    console.log("No supply key found!");
  }

  console.log("\nCheck complete");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 