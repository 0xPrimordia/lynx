import { Client, AccountId, PrivateKey, TokenCreateTransaction, TokenType, TokenSupplyType, ContractId, Hbar, KeyList } from "@hashgraph/sdk";
import * as hre from "hardhat";
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

async function main() {
  console.log("Hybrid Approach Full Test");
  console.log("=========================");
  
  // Step 1: Deploy SimpleTokenMinter contract
  console.log("\nStep 1: Deploying SimpleTokenMinter contract...");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatUnits(balance, 18), "HBAR");
  
  const SimpleTokenMinter = await hre.ethers.getContractFactory("SimpleTokenMinter");
  const minter = await SimpleTokenMinter.deploy({
    gasLimit: 1000000,
    gasPrice: hre.ethers.parseUnits("530", "gwei"),
  });
  
  await minter.waitForDeployment();
  const contractAddress = await minter.getAddress();
  console.log("SimpleTokenMinter deployed to:", contractAddress);
  
  // Fund the contract with HBAR
  console.log("\nFunding contract with HBAR...");
  const fundTx = await deployer.sendTransaction({
    to: contractAddress,
    value: hre.ethers.parseEther("1.0"),
    gasLimit: 400000,
    gasPrice: hre.ethers.parseUnits("530", "gwei"),
  });
  await fundTx.wait();
  console.log("Contract funded with 1 HBAR");
  
  // Step 2: Convert contract address to Hedera format
  console.log("\nStep 2: Converting contract address to Hedera format...");
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
  console.log("\nStep 3: Creating token via Hedera SDK...");
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  // Create token with the contract as the supply key
  const tokenCreateTx = new TokenCreateTransaction()
    .setTokenName("Hybrid Test Token")
    .setTokenSymbol("HTT")
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
  
  // Step 4: Convert token ID to EVM format for the contract
  console.log("\nStep 4: Converting token ID to EVM format...");
  const tokenAddress = convertHederaIdToEvmAddress(tokenId.toString());
  console.log("Token address in EVM format:", tokenAddress);
  
  // Step 5: Configure contract with token address
  console.log("\nStep 5: Setting token address in contract...");
  const setTokenTx = await minter.setTokenAddress(tokenAddress, {
    gasLimit: 400000,
    gasPrice: hre.ethers.parseUnits("530", "gwei"),
  });
  await setTokenTx.wait();
  console.log("Token address set in contract");
  
  // Step 6: Test if contract can mint tokens
  console.log("\nStep 6: Testing token minting with contract...");
  
  // Save test results first, so we can debug if minting fails
  const testResults: {
    contractAddress: string;
    contractIdHedera: string;
    tokenId: string;
    tokenAddress: string;
    mintAmount: string;
    balance: string;
    timestamp: string;
    standardMintSuccess?: boolean;
    rawMintSuccess?: boolean;
  } = {
    contractAddress,
    contractIdHedera: contractIdStr,
    tokenId: tokenId.toString(),
    tokenAddress,
    mintAmount: "N/A", // Will be updated if mint succeeds
    balance: "N/A", // Will be updated if mint succeeds
    timestamp: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    "hybrid-approach-test-results.json",
    JSON.stringify(testResults, null, 2)
  );
  console.log("\nInitial test results saved to hybrid-approach-test-results.json");

  // First, try the regular mintTokens function  
  console.log("\nAttempting standard mint function...");
  let standardMintSuccess = false;
  try {
    const mintAmount = 1000n;
    const mintTx = await minter.mintTokens(mintAmount, {
      gasLimit: 1000000,
      gasPrice: hre.ethers.parseUnits("530", "gwei"),
    });
    
    console.log("Mint transaction hash:", mintTx.hash);
    console.log("Waiting for transaction confirmation...");
    
    const mintReceipt = await mintTx.wait();
    console.log("Mint transaction confirmed in block:", mintReceipt?.blockNumber);
    standardMintSuccess = true;
  } catch (error) {
    console.error("Standard mint failed:", error);
  }
  
  // Now try the raw mint function
  console.log("\nAttempting raw mint function...");
  let rawMintSuccess = false;
  try {
    const mintAmount = 1000n;
    const mintTx = await minter.mintTokensRaw(mintAmount, {
      gasLimit: 1000000,
      gasPrice: hre.ethers.parseUnits("530", "gwei"),
    });
    
    console.log("Raw mint transaction hash:", mintTx.hash);
    console.log("Waiting for transaction confirmation...");
    
    const mintReceipt = await mintTx.wait();
    console.log("Raw mint transaction confirmed in block:", mintReceipt?.blockNumber);
    rawMintSuccess = true;
  } catch (error) {
    console.error("Raw mint failed:", error);
  }
  
  // Check balance regardless of mint success
  console.log("\nChecking token balance...");
  try {
    const balance = await minter.getTokenBalance();
    console.log("Token balance in contract:", balance.toString());
    
    // Update test results
    testResults.standardMintSuccess = standardMintSuccess;
    testResults.rawMintSuccess = rawMintSuccess;
    testResults.balance = balance.toString();
    
    fs.writeFileSync(
      "hybrid-approach-test-results.json",
      JSON.stringify(testResults, null, 2)
    );
    console.log("\nFinal test results saved to hybrid-approach-test-results.json");
    
    if (standardMintSuccess || rawMintSuccess) {
      console.log("\n✅ HYBRID APPROACH SUCCESSFUL!");
      console.log("This confirms that the SDK can create a token with a contract as the supply key");
      console.log("and the contract can successfully mint tokens.");
    } else {
      console.log("\n❌ HYBRID APPROACH PARTIALLY SUCCESSFUL!");
      console.log("Token creation worked but minting from contract failed.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error checking balance:", error);
    
    // Update test results with mint attempts
    testResults.standardMintSuccess = standardMintSuccess;
    testResults.rawMintSuccess = rawMintSuccess;
    
    fs.writeFileSync(
      "hybrid-approach-test-results.json",
      JSON.stringify(testResults, null, 2)
    );
    
    console.log("\n❌ HYBRID APPROACH PARTIALLY SUCCESSFUL!");
    console.log("Token creation worked but minting from contract failed.");
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