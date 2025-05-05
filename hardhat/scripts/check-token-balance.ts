import { Client, AccountId, PrivateKey, TokenInfoQuery, TokenMintTransaction, ContractId, Hbar } from "@hashgraph/sdk";
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
  const { tokenId, contractIdHedera, contractAddress, rawMintSuccess } = testResults;

  console.log("Checking balances for token:", tokenId);
  console.log("Contract with supply key:", contractIdHedera);
  console.log("Contract address:", contractAddress);
  console.log("Raw mint success:", rawMintSuccess ? "Yes" : "No");

  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );

  // Get token info before mint
  const tokenInfoBefore = await new TokenInfoQuery()
    .setTokenId(tokenId)
    .execute(client);

  console.log("\nToken Info Before Mint:");
  console.log("- Name:", tokenInfoBefore.name);
  console.log("- Symbol:", tokenInfoBefore.symbol);
  console.log("- Total Supply:", tokenInfoBefore.totalSupply.toString());
  
  // Try to mint tokens directly with the SDK
  console.log("\nAttempting to mint 2000 tokens directly with the SDK...");
  
  try {
    const mintTx = new TokenMintTransaction()
      .setTokenId(tokenId)
      .setAmount(2000)
      .setMaxTransactionFee(new Hbar(30))
      .freezeWith(client);
    
    const mintSubmit = await mintTx.execute(client);
    const mintReceipt = await mintSubmit.getReceipt(client);
    
    console.log("Mint status:", mintReceipt.status.toString());
    
    // Get token info after mint
    const tokenInfoAfter = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
      
    console.log("\nToken Info After Mint:");
    console.log("- Name:", tokenInfoAfter.name);
    console.log("- Symbol:", tokenInfoAfter.symbol);
    console.log("- Total Supply:", tokenInfoAfter.totalSupply.toString());
    
    if (tokenInfoAfter.totalSupply.toNumber() > tokenInfoBefore.totalSupply.toNumber()) {
      console.log("\n✅ DIRECT SDK MINT SUCCESSFUL!");
      console.log("This confirms that the SDK can mint tokens and increase the total supply.");
    } else {
      console.log("\n❌ DIRECT SDK MINT FAILED!");
      console.log("The transaction completed but total supply did not increase.");
    }
    
  } catch (error) {
    console.error("SDK mint failed:", error);
    console.log("\n❌ DIRECT SDK MINT FAILED!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 