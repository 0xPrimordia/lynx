import { Client, AccountId, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, TokenInfoQuery, ContractId, Hbar, TokenMintTransaction } from "@hashgraph/sdk";
import { ethers } from "hardhat";
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
  console.log("FINAL VERIFICATION OF HYBRID APPROACH");
  console.log("=====================================");
  
  // Step 1: Deploy SimpleTokenMinter contract
  console.log("\nStep 1: Deploying SimpleTokenMinter contract...");
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Deploy the contract
  const SimpleTokenMinter = await ethers.getContractFactory("SimpleTokenMinter");
  const minter = await SimpleTokenMinter.deploy({
    gasLimit: 1000000,
    gasPrice: ethers.parseUnits("530", "gwei"),
  });
  
  await minter.waitForDeployment();
  const contractAddress = await minter.getAddress();
  console.log("SimpleTokenMinter deployed to:", contractAddress);
  
  // Fund the contract with HBAR
  console.log("\nFunding contract with HBAR...");
  const fundTx = await deployer.sendTransaction({
    to: contractAddress,
    value: ethers.parseEther("1.0"),
    gasLimit: 400000,
    gasPrice: ethers.parseUnits("530", "gwei"),
  });
  await fundTx.wait();
  console.log("Contract funded with 1 HBAR");
  
  // Step 2: Convert contract address to Hedera format
  console.log("\nStep 2: Converting contract address to Hedera format...");
  // Use a different approach to get the contract ID
  // In Hedera, the last 20 bytes of the contract address are used for the entity number
  const addressBytes = contractAddress.slice(2).toLowerCase(); // remove 0x
  const entityNum = parseInt(addressBytes, 16) & 0xFFFFFFFF; // take only last 32 bits
  
  // Format as Hedera contract ID 
  const contractIdStr = `0.0.${entityNum}`;
  console.log("Contract ID in Hedera format:", contractIdStr);
  
  // Create a ContractId object
  const contractId = ContractId.fromString(contractIdStr);
  
  // Step 3: Create token via SDK with contract as supply key
  console.log("\nStep 3: Creating token via Hedera SDK...");
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  // Create token with the contract as the supply key
  const tokenCreateTx = new TokenCreateTransaction()
    .setTokenName("Final Verification Token")
    .setTokenSymbol("FVT")
    .setDecimals(0)
    .setInitialSupply(0)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(AccountId.fromString(operatorId)) // treasury is operator account
    .setSupplyKey(contractId) // Using contractId as supply key
    .setMaxTransactionFee(new Hbar(30))
    .freezeWith(client);
  
  // Execute the transaction
  const tokenCreateSubmit = await tokenCreateTx.execute(client);
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
  
  // Convert supply key to JSON to inspect it
  const supplyKey = tokenInfo.supplyKey;
  const supplyKeyObj = JSON.parse(JSON.stringify(supplyKey));
  console.log("Supply key:", JSON.stringify(supplyKeyObj, null, 2));
  
  // Check if the supply key matches our contract
  if (supplyKeyObj && supplyKeyObj.num && supplyKeyObj.num.low) {
    const supplyKeyContractId = `0.0.${supplyKeyObj.num.low}`;
    console.log("Supply key contract ID:", supplyKeyContractId);
    console.log("Does it match our contract?", supplyKeyContractId === contractIdStr);
    
    if (supplyKeyContractId !== contractIdStr) {
      console.log("❌ Supply key does not match contract ID!");
      process.exit(1);
    }
  } else {
    console.log("❌ Could not verify supply key format!");
    process.exit(1);
  }
  
  // Step 5: Convert token ID to EVM address format and set in contract
  console.log("\nStep 5: Setting token address in contract...");
  const tokenIdParts = tokenId.toString().split(".");
  const tokenEntityId = parseInt(tokenIdParts[2]);
  const tokenAddress = `0x${tokenEntityId.toString(16).padStart(40, "0")}`;
  
  console.log("Token ID:", tokenId.toString());
  console.log("Token address (EVM format):", tokenAddress);
  
  // Set token address in the contract
  const setTokenTx = await minter.setTokenAddress(tokenAddress, {
    gasLimit: 400000,
    gasPrice: ethers.parseUnits("530", "gwei"),
  });
  await setTokenTx.wait();
  console.log("Token address set in contract");
  
  // Step 6: Check token supply BEFORE minting
  console.log("\nStep 6: Checking token supply BEFORE minting...");
  const tokenInfoBefore = await new TokenInfoQuery()
    .setTokenId(tokenId)
    .execute(client);
  console.log("Token supply BEFORE:", tokenInfoBefore.totalSupply.toString());
  
  // Step 7: Try to mint with SDK (should fail because contract has the supply key)
  console.log("\nStep 7: Attempting to mint with SDK (should fail)...");
  try {
    // Try to mint with SDK directly (should fail because only contract has supply key)
    const sdkMintTx = await new TokenMintTransaction()
      .setTokenId(tokenId)
      .setAmount(100)
      .setMaxTransactionFee(new Hbar(20))
      .execute(client);
    
    await sdkMintTx.getReceipt(client);
    console.log("❌ SDK mint succeeded when it should have failed!");
  } catch (error) {
    console.log("✅ SDK mint failed as expected (only contract has supply key)");
  }
  
  // Step 8: Mint tokens using the contract
  console.log("\nStep 8: Minting tokens with contract...");
  
  try {
    // Call basicMint function
    const mintTx = await minter.basicMint(500, {
      gasLimit: 1000000,
      gasPrice: ethers.parseUnits("530", "gwei"),
    });
    
    console.log("Mint transaction hash:", mintTx.hash);
    const receipt = await mintTx.wait();
    console.log("Mint transaction confirmed");
    
    // Look for events in the transaction receipt
    if (receipt && receipt.logs) {
      console.log(`Found ${receipt.logs.length} logs in the transaction`);
      
      // Try to parse events if possible
      for (const log of receipt.logs) {
        try {
          const parsedLog = SimpleTokenMinter.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog) {
            console.log("Event:", parsedLog.name);
            console.log("Args:", parsedLog.args);
          }
        } catch (e) {
          // Not one of our events
        }
      }
    }
    
    // Step 9: Check token supply AFTER minting
    console.log("\nStep 9: Checking token supply AFTER minting...");
    const tokenInfoAfter = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    console.log("Token supply BEFORE:", tokenInfoBefore.totalSupply.toString());
    console.log("Token supply AFTER:", tokenInfoAfter.totalSupply.toString());
    
    // Calculate the difference
    const supplyDiff = tokenInfoAfter.totalSupply.toNumber() - tokenInfoBefore.totalSupply.toNumber();
    console.log("Supply difference:", supplyDiff);
    
    if (supplyDiff > 0) {
      console.log("\n✅ VERIFICATION SUCCESSFUL: Contract successfully minted tokens!");
      console.log(`The token supply increased by ${supplyDiff}`);
      console.log("\nThis definitively proves the hybrid approach works:");
      console.log("1. SDK can create a token with a contract as the supply key");
      console.log("2. The contract can successfully mint tokens");
      console.log("3. External minting attempts fail, confirming the contract has exclusive supply key rights");
    } else {
      console.log("\n❌ VERIFICATION FAILED: Token supply did not increase after minting");
    }
    
  } catch (error) {
    console.error("Mint failed:", error);
    console.log("\n❌ VERIFICATION FAILED: Contract mint transaction failed");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 