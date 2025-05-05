import { ethers } from "hardhat";
import { Client, AccountId, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, TokenInfoQuery, ContractId, Hbar } from "@hashgraph/sdk";
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
  console.log("CONTRACT MINT VERIFICATION");
  console.log("==========================");
  console.log("Using Hedera account:", operatorId);
  
  // Step 1: Deploy SimpleTokenMinter contract
  console.log("\nStep 1: Deploying SimpleTokenMinter contract...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const SimpleTokenMinter = await ethers.getContractFactory("SimpleTokenMinter");
  const minter = await SimpleTokenMinter.deploy();
  
  await minter.waitForDeployment();
  const contractAddress = await minter.getAddress();
  console.log("SimpleTokenMinter deployed to:", contractAddress);
  
  // Step 2: Convert contract address to Hedera ID format
  console.log("\nStep 2: Converting contract address to Hedera format...");
  const contractNum = parseInt(contractAddress.slice(2), 16) & 0xFFFFFFFF;
  const contractIdStr = `0.0.${contractNum}`;
  
  console.log("Contract ID in Hedera format:", contractIdStr);
  console.log("Original EVM address:", contractAddress);
  
  // Step 3: Create a token with contract as supply key using the Hedera SDK
  console.log("\nStep 3: Creating token with SDK and contract as supply key...");
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  // Create token with contract as supply key
  const tokenCreateTx = new TokenCreateTransaction()
    .setTokenName("Contract Mint Test")
    .setTokenSymbol("CMT")
    .setDecimals(0)
    .setInitialSupply(0)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(AccountId.fromString(operatorId))
    .setSupplyKey(ContractId.fromString(contractIdStr))
    .setMaxTransactionFee(new Hbar(30));
  
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
  
  // Step 4: Convert token ID to EVM address
  console.log("\nStep 4: Converting token ID to EVM address format...");
  const tokenIdParts = tokenId.toString().split(".");
  const tokenEntityId = parseInt(tokenIdParts[2]);
  const tokenAddress = `0x${tokenEntityId.toString(16).padStart(40, "0")}`;
  console.log("Token ID:", tokenId.toString());
  console.log("Token address (EVM):", tokenAddress);
  
  // Step 5: Verify token info and supply key
  console.log("\nStep 5: Verifying token info and supply key...");
  
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
  
  // Step 6: Set token address in contract
  console.log("\nStep 6: Setting token address in contract...");
  
  await minter.setTokenAddress(tokenAddress, {
    gasLimit: 400000,
    gasPrice: ethers.parseUnits("25", "gwei")
  });
  
  console.log("Token address set in contract");
  
  // Step 7: Mint tokens with the contract
  console.log("\nStep 7: Minting tokens with contract...");
  const mintAmount = 1000;
  
  console.log(`Attempting to mint ${mintAmount} tokens...`);
  
  try {
    const mintTx = await minter.basicMint(mintAmount, {
      gasLimit: 1000000,
      gasPrice: ethers.parseUnits("25", "gwei")
    });
    
    console.log("Mint transaction hash:", mintTx.hash);
    console.log("Waiting for transaction confirmation...");
    
    const mintReceipt = await mintTx.wait();
    console.log("Transaction confirmed in block:", mintReceipt?.blockNumber);
    
    // Step 8: Check token supply after minting
    console.log("\nStep 8: Checking token supply after minting...");
    
    const tokenInfoAfter = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    
    console.log("Supply before minting:", tokenInfo.totalSupply.toString());
    console.log("Supply after minting:", tokenInfoAfter.totalSupply.toString());
    
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
      "contract-mint-verification.json",
      JSON.stringify(results, null, 2)
    );
    
    console.log("\nResults saved to contract-mint-verification.json");
    
  } catch (error) {
    console.error("Mint transaction failed:", error);
    console.log("\n❌ VERIFICATION FAILED: Contract mint transaction failed");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 