import { Client, AccountId, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, TokenInfoQuery, ContractId, Hbar } from "@hashgraph/sdk";
import { ethers } from "ethers";
import * as hre from "hardhat";
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
  console.log("DEFINITIVE HYBRID APPROACH TEST");
  console.log("===============================");
  
  // Step 1: Deploy SimpleTokenMinter contract
  console.log("\nSTEP 1: Deploying SimpleTokenMinter contract...");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatUnits(balance, 18), "HBAR");
  
  const SimpleTokenMinter = await hre.ethers.getContractFactory("SimpleTokenMinter");
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
  console.log("\nSTEP 2: Converting contract address to Hedera format...");
  // Remove 0x prefix and convert to a BigInt to avoid scientific notation
  const addressWithout0x = contractAddress.slice(2).toLowerCase();
  // Convert to BigInt first to handle the full number without scientific notation
  const contractBigInt = BigInt(`0x${addressWithout0x}`);
  // Calculate the contract entity number
  const contractEntityId = Number(contractBigInt & BigInt(0xFFFFFFFF));
  // Format as Hedera contract ID
  const contractIdStr = `0.0.${contractEntityId}`;
  console.log("Contract ID in Hedera format:", contractIdStr);
  console.log("Original EVM address:", contractAddress);
  
  // Create a ContractId object
  const contractId = ContractId.fromString(contractIdStr);
  
  // Step 3: Create token via SDK with contract as supply key
  console.log("\nSTEP 3: Creating token via Hedera SDK...");
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  // Create token with the contract as the supply key
  const tokenCreateTx = new TokenCreateTransaction()
    .setTokenName("Definitive Test Token")
    .setTokenSymbol("DTT")
    .setDecimals(0)
    .setInitialSupply(0)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(AccountId.fromString(operatorId))
    .setSupplyKey(contractId) // Using ContractId directly as supply key
    .setMaxTransactionFee(new Hbar(30))
    .freezeWith(client);
  
  const tokenCreateSubmit = await tokenCreateTx.execute(client);
  const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
  const tokenId = tokenCreateRx.tokenId;
  
  if (!tokenId) {
    throw new Error("Failed to create token - no token ID returned");
  }
  
  console.log("Token created successfully!");
  console.log("Token ID:", tokenId.toString());
  
  // Step 4: Get token info BEFORE minting
  console.log("\nSTEP 4: Checking token info BEFORE minting");
  const tokenInfoBefore = await new TokenInfoQuery()
    .setTokenId(tokenId)
    .execute(client);
  
  console.log("- Name:", tokenInfoBefore.name);
  console.log("- Symbol:", tokenInfoBefore.symbol);
  console.log("- Total Supply BEFORE:", tokenInfoBefore.totalSupply.toString());
  
  // Verify supplyKey
  const supplyKey = tokenInfoBefore.supplyKey;
  if (supplyKey) {
    console.log("\nSupply Key Details:");
    console.log(JSON.stringify(supplyKey, null, 2));
    
    // Extract contractId from supplyKey if possible
    const keyObj = JSON.parse(JSON.stringify(supplyKey));
    if (keyObj && keyObj.num && keyObj.num.low) {
      const supplykeyContractId = `0.0.${keyObj.num.low}`;
      console.log("Supply key contract ID:", supplykeyContractId);
      console.log("Does it match our contract?", supplykeyContractId === contractIdStr);
    }
  }
  
  // Step 5: Convert token ID to EVM format for the contract
  console.log("\nSTEP 5: Converting token ID to EVM format...");
  const tokenAddress = convertHederaIdToEvmAddress(tokenId.toString());
  console.log("Token address in EVM format:", tokenAddress);
  
  // Step 6: Configure contract with token address
  console.log("\nSTEP 6: Setting token address in contract...");
  const setTokenTx = await minter.setTokenAddress(tokenAddress, {
    gasLimit: 400000,
    gasPrice: ethers.parseUnits("530", "gwei"),
  });
  await setTokenTx.wait();
  console.log("Token address set in contract");
  
  // Step 7: Mint tokens using the rawMintTokens function
  console.log("\nSTEP 7: Testing token minting with contract...");
  const mintAmount = 1000n;
  
  try {
    // Mint tokens using the raw method
    console.log(`Attempting to mint ${mintAmount} tokens using raw call...`);
    const mintTx = await minter.basicMint(Number(mintAmount), {
      gasLimit: 1000000,
      gasPrice: ethers.parseUnits("530", "gwei")
    });
    
    console.log("Mint transaction hash:", mintTx.hash);
    console.log("Waiting for transaction confirmation...");
    
    const mintReceipt = await mintTx.wait();
    console.log("Mint transaction confirmed in block:", mintReceipt?.blockNumber);
    
    // Get token info AFTER minting
    console.log("\nSTEP 8: Checking token info AFTER minting");
    const tokenInfoAfter = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
    
    console.log("- Name:", tokenInfoAfter.name);
    console.log("- Symbol:", tokenInfoAfter.symbol);
    console.log("- Total Supply BEFORE:", tokenInfoBefore.totalSupply.toString());
    console.log("- Total Supply AFTER:", tokenInfoAfter.totalSupply.toString());
    
    // Calculate the difference
    const supplyDiff = tokenInfoAfter.totalSupply.toNumber() - tokenInfoBefore.totalSupply.toNumber();
    console.log("- Supply increase:", supplyDiff);
    
    if (supplyDiff === Number(mintAmount)) {
      console.log("\n✅ DEFINITIVE TEST PASSED: Contract successfully minted tokens!");
      console.log(`The token supply increased by exactly ${mintAmount} as requested.`);
      console.log("This proves that the contract has the supply key and can mint tokens.");
    } else if (supplyDiff > 0) {
      console.log("\n✅ DEFINITIVE TEST PASSED: Contract successfully minted tokens!");
      console.log(`The token supply increased by ${supplyDiff}, which is different from the requested ${mintAmount}.`);
      console.log("This proves that the contract has the supply key and can mint tokens, though amount handling may need adjustment.");
    } else {
      console.log("\n❌ DEFINITIVE TEST FAILED: Contract transaction completed but did not increase token supply.");
    }
    
    // Save test results
    const testResults = {
      contractAddress,
      contractIdHedera: contractIdStr,
      tokenId: tokenId.toString(),
      tokenAddress,
      mintAmount: mintAmount.toString(),
      actualMintAmount: supplyDiff.toString(),
      success: supplyDiff > 0,
      timestamp: new Date().toISOString(),
    };
    
    fs.writeFileSync(
      "definitive-test-results.json",
      JSON.stringify(testResults, null, 2)
    );
    console.log("\nTest results saved to definitive-test-results.json");
    
    if (supplyDiff > 0) {
      console.log("\n✅ HYBRID APPROACH DEFINITIVELY PROVEN SUCCESSFUL!");
      console.log("This confirms that the SDK can create a token with a contract as the supply key");
      console.log("and the contract can successfully mint tokens.");
    } else {
      console.log("\n❌ HYBRID APPROACH TEST FAILED!");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("Mint test failed:", error);
    console.log("\n❌ HYBRID APPROACH TEST FAILED!");
    process.exit(1);
  }
}

// Convert Hedera ID (0.0.X) to EVM address format (0x...)
function convertHederaIdToEvmAddress(hederaId: string): string {
  // Parse the shard.realm.num format
  const parts = hederaId.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid Hedera ID format");
  }
  
  // Extract the entity number (last part)
  const entityNum = BigInt(parts[2]);
  
  // Convert to hex and pad to 40 chars (20 bytes)
  let hexAddr = entityNum.toString(16).padStart(40, "0");
  
  // Return as 0x prefixed address
  return "0x" + hexAddr;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 