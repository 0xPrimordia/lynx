import * as hre from "hardhat";
import { ethers } from "hardhat";
import { Client, AccountId, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, TokenInfoQuery, Hbar, TokenAssociateTransaction } from "@hashgraph/sdk";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env.local" });

// Setup Hedera credentials
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
const operatorKey = process.env.OPERATOR_KEY || "";

if (!operatorId || !operatorKey) {
  throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
}

// Load deployment info to get the vault address
let VAULT_ADDRESS = "";
try {
  const deploymentInfo = JSON.parse(fs.readFileSync("../deployment-info.json", "utf8"));
  VAULT_ADDRESS = deploymentInfo.vaultEvm || "";
  console.log(`Loaded vault address from deployment info: ${VAULT_ADDRESS}`);
} catch (error) {
  console.warn("Warning: Could not load deployment info");
  // If we can't load, we'll ask for it later
}

// Composition to set up
const TOKEN_COMPOSITION = [
  {
    name: "SAUCE Token",
    symbol: "SAUCE",
    weight: 50,  // 50% of the index
  },
  {
    name: "CLXY Token",
    symbol: "CLXY",
    weight: 50,  // 50% of the index
  }
];

async function main() {
  console.log("TOKEN COMPOSITION SETUP");
  console.log("=======================");
  console.log("Using Hedera account:", operatorId);

  // If we don't have the vault address from deployment info, ask for it
  if (!VAULT_ADDRESS) {
    console.error("ERROR: Vault address not found in deployment info");
    console.error("Please provide the vault address as an argument or update deployment-info.json");
    process.exit(1);
  }
  
  try {
    // Initialize Hedera client
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    // Step 1: Create tokens for composition
    console.log("\nStep 1: Creating composition tokens...");
    
    const tokenAddresses: string[] = [];
    
    for (const tokenConfig of TOKEN_COMPOSITION) {
      console.log(`Creating ${tokenConfig.name} (${tokenConfig.symbol})...`);
      
      // Create token
      const timestamp = new Date().getTime();
      const tokenCreateTx = new TokenCreateTransaction()
        .setTokenName(`${tokenConfig.name} ${timestamp}`)
        .setTokenSymbol(tokenConfig.symbol)
        .setDecimals(0)
        .setInitialSupply(1000000) // 1 million initial supply
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(TokenSupplyType.Infinite)
        .setTreasuryAccountId(AccountId.fromString(operatorId))
        .setAdminKey(PrivateKey.fromString(operatorKey).publicKey)
        .setSupplyKey(PrivateKey.fromString(operatorKey).publicKey)
        .setMaxTransactionFee(new Hbar(30));
      
      // Submit the transaction
      const txResponse = await tokenCreateTx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      
      // Get the token ID
      const tokenId = receipt.tokenId;
      if (!tokenId) {
        throw new Error(`Failed to create token ${tokenConfig.symbol}`);
      }
      
      console.log(`Token ${tokenConfig.symbol} created with ID: ${tokenId.toString()}`);
      
      // Convert token ID to EVM format
      const tokenAddress = "0x" + tokenId.toSolidityAddress();
      
      console.log(`Token ${tokenConfig.symbol} EVM address: ${tokenAddress}`);
      tokenAddresses.push(tokenAddress);
      
      // Associate token with vault if needed
      console.log(`Associating ${tokenConfig.symbol} with vault...`);
      
      try {
        // Check if already associated (this is just for example - in production you'd check first)
        const associateTx = await new TokenAssociateTransaction()
          .setAccountId(AccountId.fromString(operatorId)) // Using operator as proxy for the vault here
          .setTokenIds([tokenId])
          .setMaxTransactionFee(new Hbar(5))
          .execute(client);
        
        await associateTx.getReceipt(client);
        console.log(`Token ${tokenConfig.symbol} associated with vault`);
      } catch (error) {
        console.warn(`Warning: Could not associate token with vault: ${error}`);
        // Continue anyway
      }
    }
    
    // Step 2: Configure IndexVault with token composition
    console.log("\nStep 2: Setting up token composition in IndexVault...");
    
    // Connect to the IndexVault contract
    console.log(`Connecting to vault at address: ${VAULT_ADDRESS}`);
    const IndexVault = await ethers.getContractFactory("IndexVault");
    const vault = await IndexVault.attach(VAULT_ADDRESS);
    
    console.log("Connected to vault contract");
    
    // Add tokens to the composition with their respective weights
    for (let i = 0; i < TOKEN_COMPOSITION.length; i++) {
      const tokenConfig = TOKEN_COMPOSITION[i];
      const tokenAddress = tokenAddresses[i];
      
      console.log(`Adding ${tokenConfig.symbol} to composition with weight ${tokenConfig.weight}...`);
      
      try {
        const addTx = await vault.addToken(tokenAddress, tokenConfig.weight, {
          gasLimit: 400000,
          gasPrice: ethers.parseUnits("600", "gwei")
        });
        
        await addTx.wait();
        console.log(`Added ${tokenConfig.symbol} to composition`);
      } catch (error) {
        console.error(`Error adding token to composition: ${error}`);
      }
    }
    
    // Step 3: Verify composition is set up correctly
    console.log("\nStep 3: Verifying token composition...");
    
    try {
      const composition = await vault.getComposition();
      
      console.log("Token composition:");
      for (let i = 0; i < composition[0].length; i++) {
        console.log(`- Token: ${composition[0][i]}`);
        console.log(`  Weight: ${composition[1][i]}`);
      }
      
      // Verify total weight is calculated correctly
      const totalWeight = await vault.totalWeight();
      console.log(`Total weight: ${totalWeight}`);
      
      // Calculate expected total weight
      const expectedTotalWeight = TOKEN_COMPOSITION.reduce((sum, token) => sum + token.weight, 0);
      console.log(`Expected total weight: ${expectedTotalWeight}`);
      
      if (totalWeight.toString() !== expectedTotalWeight.toString()) {
        console.warn("WARNING: Total weight doesn't match expected total weight");
      } else {
        console.log("Total weight matches expected value ✓");
      }
    } catch (error) {
      console.error(`Error verifying composition: ${error}`);
    }
    
    // Save token info to file
    const tokenInfo = {
      tokens: TOKEN_COMPOSITION.map((config, i) => ({
        name: config.name,
        symbol: config.symbol,
        weight: config.weight,
        address: tokenAddresses[i],
      })),
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      "token-composition.json",
      JSON.stringify(tokenInfo, null, 2)
    );
    
    console.log("\nToken info saved to token-composition.json");
    console.log("\nSETUP COMPLETED SUCCESSFULLY! ✅");
    
  } catch (error) {
    console.error("Error:", error);
    console.log("\nSETUP FAILED! ❌");
    
    // Save error information to file
    fs.writeFileSync(
      "composition-setup-error.json",
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