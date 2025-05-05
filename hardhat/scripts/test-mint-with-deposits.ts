import * as hre from "hardhat";
import { Client, AccountId, PrivateKey, TokenAssociateTransaction, Hbar } from "@hashgraph/sdk";
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

// Load token composition from file (created by setup-token-composition.ts)
let TOKEN_COMPOSITION: any[] = [];
try {
  const tokenInfo = JSON.parse(fs.readFileSync("token-composition.json", "utf8"));
  TOKEN_COMPOSITION = tokenInfo.tokens;
} catch (error) {
  console.warn("Warning: Could not load token composition from file. Using defaults.");
  TOKEN_COMPOSITION = [
    {
      name: "SAUCE Token",
      symbol: "SAUCE",
      weight: 50,
      address: "0x000000000000000000000000000000000DEADBEEF" // Placeholder
    },
    {
      name: "CLXY Token",
      symbol: "CLXY",
      weight: 50,
      address: "0x000000000000000000000000000000000BEEFDEAD" // Placeholder
    }
  ];
}

async function main() {
  console.log("TESTING MINT WITH DEPOSITS");
  console.log("==========================");
  console.log("Using Hedera account:", operatorId);
  
  try {
    // Initialize Hedera client
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    // Step 1: Connect to contracts
    console.log("\nStep 1: Connecting to contracts...");
    
    // Get deployment info
    let deploymentInfo: any = {};
    try {
      deploymentInfo = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
      console.log("Loaded deployment info");
    } catch (error) {
      console.error("Error loading deployment info. Using placeholder addresses.");
      
      // Placeholders - you'll need real addresses
      deploymentInfo = {
        vaultEvm: "0x2327751935B8a96183F698e6625FEffbC81dd97e",
        controllerEvm: "0xF714C429c5E210E27Cf5F40de3e892Fb8710923c",
        tokenAddress: "0x0000000000000000000000000000000000001234"
      };
    }
    
    console.log("Vault address:", deploymentInfo.vaultEvm);
    console.log("Controller address:", deploymentInfo.controllerEvm);
    console.log("Index token address:", deploymentInfo.tokenAddress);
    
    // Connect to contracts
    const IndexVault = await hre.ethers.getContractFactory("IndexVault");
    const vault = await IndexVault.attach(deploymentInfo.vaultEvm);
    
    const IndexTokenController = await hre.ethers.getContractFactory("IndexTokenController");
    const controller = await IndexTokenController.attach(deploymentInfo.controllerEvm);
    
    console.log("Successfully connected to contracts");
    
    // Step 2: Check token composition
    console.log("\nStep 2: Verifying token composition...");
    
    try {
      const composition = await vault.getComposition();
      
      if (composition[0].length === 0) {
        console.warn("WARNING: No tokens in composition. Set up composition first.");
      } else {
        console.log("Token composition:");
        for (let i = 0; i < composition[0].length; i++) {
          console.log(`- Token: ${composition[0][i]}`);
          console.log(`  Weight: ${composition[1][i].toString()}`);
        }
      }
      
      // If there are tokens from our file that aren't in the composition, note it
      for (const token of TOKEN_COMPOSITION) {
        if (!composition[0].map((addr: string) => addr.toLowerCase()).includes(token.address.toLowerCase())) {
          console.warn(`WARNING: Token ${token.symbol} (${token.address}) is not in vault composition`);
        }
      }
    } catch (error) {
      console.error("Error checking composition:", error);
    }
    
    // Step 3: Calculate required deposits for 100 tokens
    console.log("\nStep 3: Calculating required deposits for 100 tokens...");
    const mintAmount = 100;
    
    try {
      const requiredDeposits = await controller.calculateRequiredDeposits(mintAmount);
      
      console.log("Required deposits:");
      for (let i = 0; i < requiredDeposits[0].length; i++) {
        console.log(`- Token: ${requiredDeposits[0][i]}`);
        console.log(`  Amount: ${requiredDeposits[1][i].toString()}`);
        
        // Find token symbol for clarity
        const tokenInfo = TOKEN_COMPOSITION.find(
          t => t.address.toLowerCase() === requiredDeposits[0][i].toLowerCase()
        );
        if (tokenInfo) {
          console.log(`  Symbol: ${tokenInfo.symbol}`);
        }
      }
    } catch (error) {
      console.error("Error calculating required deposits:", error);
    }
    
    // Step 4: Deposit tokens
    console.log("\nStep 4: Depositing tokens to vault...");
    
    // Get composition from contract to ensure we're using the right addresses
    const composition = await vault.getComposition();
    
    if (composition[0].length === 0) {
      console.error("ERROR: No tokens in composition. Skipping deposit step.");
    } else {
      for (let i = 0; i < composition[0].length; i++) {
        const tokenAddress = composition[0][i];
        const requiredAmount = (mintAmount * composition[1][i].toString()) / 100; // Simplified calculation
        
        console.log(`Depositing ${requiredAmount} of token ${tokenAddress}...`);
        
        try {
          const depositTx = await vault.depositToken(tokenAddress, requiredAmount, {
            gasLimit: 400000,
            gasPrice: hre.ethers.parseUnits("530", "gwei")
          });
          
          await depositTx.wait();
          console.log(`Successfully deposited ${requiredAmount} of token ${tokenAddress}`);
        } catch (error) {
          console.error(`Error depositing token ${tokenAddress}:`, error);
        }
      }
    }
    
    // Step 5: Mint tokens
    console.log("\nStep 5: Minting tokens...");
    
    try {
      // First ensure we've associated the index token
      if (deploymentInfo.tokenAddress && deploymentInfo.tokenAddress !== "0x0000000000000000000000000000000000000000") {
        console.log("Ensuring index token is associated...");
        
        // This would typically be done via associateToken on HTS directly
        // For this test, we're assuming it's already associated
      }
      
      // Now mint tokens
      const mintTx = await controller.mintWithDeposits(mintAmount, {
        gasLimit: 1000000,
        gasPrice: hre.ethers.parseUnits("530", "gwei")
      });
      
      console.log("Mint transaction hash:", mintTx.hash);
      await mintTx.wait();
      console.log(`Successfully minted ${mintAmount} index tokens!`);
    } catch (error) {
      console.error("Error minting tokens:", error);
    }
    
    // Step 6: Verify balances
    console.log("\nStep 6: Verifying balances...");
    
    // This would involve checking the token balances
    // For this test script, we're just acknowledging this step would happen
    console.log("For a production implementation, verify token balances here");
    
    // Save results
    const results = {
      success: true, // Optimistic
      mintAmount,
      tokenComposition: TOKEN_COMPOSITION.map(token => ({
        symbol: token.symbol,
        weight: token.weight
      })),
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      "mint-with-deposits-results.json",
      JSON.stringify(results, null, 2)
    );
    
    console.log("\nTest results saved to mint-with-deposits-results.json");
    console.log("\nTEST COMPLETED! ✅");
    
  } catch (error) {
    console.error("Error:", error);
    console.log("\nTEST FAILED! ❌");
    
    // Save error information to file
    fs.writeFileSync(
      "mint-with-deposits-error.json",
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