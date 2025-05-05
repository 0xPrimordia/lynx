import { 
  Client, 
  AccountId, 
  PrivateKey, 
  TokenCreateTransaction, 
  TokenType, 
  TokenSupplyType, 
  TokenInfoQuery,
  Hbar,
  ContractId
} from "@hashgraph/sdk";
import * as fs from "fs";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: "../../.env.local" });

// Setup Hedera credentials
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
const operatorKey = process.env.OPERATOR_KEY || "";

if (!operatorId || !operatorKey) {
  throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
}

async function main() {
  console.log("CREATING TOKEN VIA SDK (HYBRID APPROACH)");
  console.log("========================================");
  console.log(`Using operator account: ${operatorId}`);
  
  // Load deployment info
  const deploymentPath = path.join(__dirname, "../../../deployment-info.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const vaultId = deploymentInfo.vaultId;
  const controllerId = deploymentInfo.controllerId;
  
  console.log(`Vault ID: ${vaultId}`);
  console.log(`Controller ID: ${controllerId}`);
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  // Create token with controller as supply key
  console.log("\nCreating Lynx Index Token...");
  
  try {
    // Vault as treasury
    const treasuryId = AccountId.fromString(vaultId);
    
    // Controller as supply key
    const supplyKeyContractId = ContractId.fromString(controllerId);
    
    // Admin key (operator for now)
    const adminKey = PrivateKey.fromString(operatorKey).publicKey;
    
    const tokenCreateTx = new TokenCreateTransaction()
      .setTokenName("Lynx Index Token")
      .setTokenSymbol("LYNX")
      .setDecimals(8)
      .setInitialSupply(0)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(treasuryId)
      .setAdminKey(adminKey)
      .setSupplyKey(supplyKeyContractId)
      .setMaxTransactionFee(new Hbar(30));
    
    console.log("Submitting token creation transaction...");
    
    // Sign and submit transaction
    const txResponse = await tokenCreateTx.execute(client);
    
    // Get receipt to ensure successful execution
    console.log("Waiting for receipt...");
    const receipt = await txResponse.getReceipt(client);
    
    // Get the token ID from the receipt
    const tokenId = receipt.tokenId;
    if (!tokenId) {
      throw new Error("Failed to create token - no token ID in receipt");
    }
    
    console.log(`\n✅ SUCCESS! Token created with ID: ${tokenId.toString()}`);
    
    // Get token info to verify
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    
    console.log(`\nToken Info:`);
    console.log(`- Name: ${tokenInfo.name}`);
    console.log(`- Symbol: ${tokenInfo.symbol}`);
    console.log(`- Decimals: ${tokenInfo.decimals}`);
    console.log(`- Total Supply: ${tokenInfo.totalSupply}`);
    console.log(`- Treasury Account: ${tokenInfo.treasuryAccountId?.toString()}`);
    
    // Convert to EVM address format
    const tokenEvmAddress = `0x${tokenId.toSolidityAddress()}`;
    console.log(`\nToken EVM Address: ${tokenEvmAddress}`);
    
    // Update deployment info
    deploymentInfo.tokenId = tokenId.toString();
    deploymentInfo.tokenAddress = tokenEvmAddress;
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\nDeployment info updated");
    
    // Next steps
    console.log("\nNext Steps:");
    console.log("1. Set the token ID in the controller contract");
    console.log("2. Update vault to work with the token");
    console.log(`3. Run: npx hardhat run scripts/token/set-token-id.ts --network hederaTestnet`);
    
  } catch (error) {
    console.error("Error creating token:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 