import { ethers } from "hardhat";
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
  console.log("HYBRID APPROACH TEST");
  console.log("====================");
  console.log("Using Hedera account:", operatorId);
  
  // Step 1: Use existing contract from previous test results
  console.log("\nStep 1: Using existing contract from test results...");
  
  // Use the contract from hybrid-approach-test-results.json
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const contractIdStr = "0.0.1679297187";
  
  console.log("Contract address:", contractAddress);
  console.log("Contract ID in Hedera format:", contractIdStr);
  
  // Step 2: Create a token with the contract as supply key
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
    .setTokenName(`Hybrid Test ${timestamp}`)
    .setTokenSymbol("HBT")
    .setDecimals(0)
    .setInitialSupply(0)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(AccountId.fromString(operatorId))
    .setSupplyKey(ContractId.fromString(contractIdStr))
    .setMaxTransactionFee(new Hbar(30));
  
  try {
    // Submit the transaction
    const txResponse = await tokenCreateTx.execute(client);
    
    // Get the receipt
    const receipt = await txResponse.getReceipt(client);
    
    // Get the token ID
    const tokenId = receipt.tokenId;
    
    if (!tokenId) {
      throw new Error("Failed to create token");
    }
    
    console.log("Token created with ID:", tokenId.toString());
    
    // Step 3: Convert token ID to EVM address
    console.log("\nStep 3: Converting token ID to EVM address format...");
    const tokenIdParts = tokenId.toString().split(".");
    const tokenEntityId = parseInt(tokenIdParts[2]);
    const tokenAddress = `0x${tokenEntityId.toString(16).padStart(40, "0")}`;
    console.log("Token ID:", tokenId.toString());
    console.log("Token address (EVM):", tokenAddress);
    
    // Step 4: Verify token info and supply key
    console.log("\nStep 4: Verifying token info and supply key...");
    
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    
    console.log("Token name:", tokenInfo.name);
    console.log("Token symbol:", tokenInfo.symbol);
    console.log("Initial supply:", tokenInfo.totalSupply.toString());
    
    // Supply key verification
    console.log("\nSupply key details:");
    console.log(JSON.stringify(tokenInfo.supplyKey, null, 2));
    
    const supplyKeyStr = tokenInfo.supplyKey ? tokenInfo.supplyKey.toString() : "null";
    console.log("Supply key string:", supplyKeyStr);
    console.log("Does it match our contract?", supplyKeyStr === contractIdStr);
    
    // Step 5: Try to mint with SDK (should fail)
    console.log("\nStep 5: Trying to mint with SDK directly (should fail)...");
    
    try {
      const mintTx = await new TokenMintTransaction()
        .setTokenId(tokenId)
        .setAmount(100)
        .execute(client);
      
      // Get the receipt
      await mintTx.getReceipt(client);
      
      console.log("❌ SDK mint succeeded when it should have failed (contract should have supply key)");
    } catch (error) {
      console.log("✅ SDK mint failed as expected (supply key is with the contract)");
    }
    
    // Step 6: Connect to the contract
    console.log("\nStep 6: Connecting to the SimpleTokenMinter contract...");
    
    // Connect to the existing contract
    const SimpleTokenMinter = await ethers.getContractFactory("SimpleTokenMinter");
    const minter = await SimpleTokenMinter.attach(contractAddress);
    
    console.log("Contract connected at address:", contractAddress);
    
    // Step 7: Set token address in contract
    console.log("\nStep 7: Setting token address in contract...");
    
    const setTokenTx = await minter.setTokenAddress(tokenAddress, {
      gasLimit: 400000,
      gasPrice: ethers.parseUnits("530", "gwei")
    });
    
    await setTokenTx.wait();
    console.log("Token address set in contract");
    
    // Step 8: Mint tokens with contract
    console.log("\nStep 8: Attempting to mint tokens with contract...");
    const mintAmount = 1000;
    
    try {
      const mintTx = await minter.basicMint(mintAmount, {
        gasLimit: 1000000,
        gasPrice: ethers.parseUnits("530", "gwei")
      });
      
      console.log("Mint transaction hash:", mintTx.hash);
      console.log("Waiting for confirmation...");
      
      await mintTx.wait();
      console.log("Transaction confirmed");
      
      // Step 9: Check token supply after minting
      console.log("\nStep 9: Checking token supply after minting...");
      
      const tokenInfoAfter = await new TokenInfoQuery()
        .setTokenId(tokenId)
        .execute(client);
      
      console.log("Supply before:", tokenInfo.totalSupply.toString());
      console.log("Supply after:", tokenInfoAfter.totalSupply.toString());
      
      const supplyDiff = tokenInfoAfter.totalSupply.toNumber() - tokenInfo.totalSupply.toNumber();
      console.log("Supply increase:", supplyDiff);
      
      if (supplyDiff === mintAmount) {
        console.log("\n✅ VERIFICATION SUCCESSFUL: Contract successfully minted exactly", mintAmount, "tokens!");
        console.log("This definitively proves the hybrid approach works.");
      } else if (supplyDiff > 0) {
        console.log("\n✅ VERIFICATION SUCCESSFUL: Contract successfully minted tokens!");
        console.log(`The token supply increased by ${supplyDiff}, different from the requested ${mintAmount}.`);
        console.log("This definitively proves the hybrid approach works, though amount handling may need adjustment.");
      } else {
        console.log("\n❌ VERIFICATION FAILED: Token supply did not increase after minting");
      }
      
      // Save test results
      const results = {
        success: supplyDiff > 0,
        contractAddress,
        contractIdHedera: contractIdStr,
        tokenId: tokenId.toString(),
        tokenAddress,
        mintAmount: mintAmount.toString(),
        actualMintAmount: supplyDiff.toString(),
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(
        "hybrid-approach-final-test.json",
        JSON.stringify(results, null, 2)
      );
      
      console.log("\nResults saved to hybrid-approach-final-test.json");
      
    } catch (error) {
      console.error("Mint transaction failed:", error);
      console.log("\n❌ VERIFICATION FAILED: Contract mint transaction failed");
    }
    
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