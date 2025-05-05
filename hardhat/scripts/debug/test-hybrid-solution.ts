import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  ContractId,
  Hbar,
  TokenInfoQuery
} from "@hashgraph/sdk";
import dotenv from "dotenv";
import fs from "fs";
import { ethers } from "hardhat";
import { Log } from "@ethersproject/abstract-provider";

// Load environment variables
dotenv.config({ path: "../../.env.local" });

// Validate environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;

if (!operatorId || !operatorKey) {
  throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
}

async function main() {
  console.log("Hybrid Token Creation and Minting Test");
  console.log("=====================================");
  
  // Get the minter contract address
  if (!fs.existsSync("debug-minter-deployment-info.json")) {
    console.error("No minter contract deployment found. Deploy the minter contract first.");
    process.exit(1);
  }
  
  const deploymentInfo = JSON.parse(
    fs.readFileSync("debug-minter-deployment-info.json", "utf8")
  );
  const contractAddress = deploymentInfo.minterContract;
  console.log("Using minter contract:", contractAddress);
  
  // Connect to the deployed contract
  const TestHTSMinter = await ethers.getContractFactory("TestHTSMinter");
  const minterContract = TestHTSMinter.attach(contractAddress);
  
  // Fund the contract with 5 HBAR if needed
  const [deployer] = await ethers.getSigners();
  const contractBalance = await ethers.provider.getBalance(contractAddress);
  if (contractBalance < ethers.parseEther("5.0")) {
    console.log("Funding contract with 5 HBAR...");
    const tx = await deployer.sendTransaction({
      to: contractAddress,
      value: ethers.parseEther("5.0"),
      gasLimit: 400000,
      gasPrice: ethers.parseUnits("530", "gwei"),
    });
    await tx.wait();
    console.log("Contract funded");
  } else {
    console.log("Contract already has sufficient funds");
  }
  
  // Convert EVM address to Hedera contract ID format
  const contractIdStr = convertEvmAddressToContractId(contractAddress);
  console.log("Converted to Hedera ContractId:", contractIdStr);
  const contractId = ContractId.fromString(contractIdStr);
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  console.log("Creating token with contract as supply key (via SDK)...");
  
  try {
    // Create token with contract as supply key
    const tokenCreateTx = new TokenCreateTransaction()
      .setTokenName("Hybrid Minter Test")
      .setTokenSymbol("HMT")
      .setDecimals(0)
      .setInitialSupply(0)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(AccountId.fromString(operatorId))
      .setSupplyKey(contractId) // Contract has supply key
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
    
    // Convert token ID to EVM address format
    const tokenAddress = convertHederaIdToEvmAddress(tokenId.toString());
    console.log("Token address in EVM format:", tokenAddress);
    
    // Save token info
    const tokenInfo = {
      tokenId: tokenId.toString(),
      tokenAddress,
      contractAddress,
      contractIdHedera: contractIdStr,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      "hybrid-minting-token-info.json",
      JSON.stringify(tokenInfo, null, 2)
    );
    console.log("Token info saved to hybrid-minting-token-info.json");
    
    // Set the token address in the minter contract
    console.log("\nSetting token address in minter contract...");
    const setTokenTx = await minterContract.setTokenAddress(tokenAddress, {
      gasLimit: 400000,
      gasPrice: ethers.parseUnits("530", "gwei")
    });
    await setTokenTx.wait();
    console.log("Token address set in contract");
    
    // Verify token info through the contract
    console.log("\nVerifying token info through contract...");
    const tokenInfo1 = await minterContract.getTokenInfo();
    console.log("Token Info from contract:");
    console.log("- Name:", tokenInfo1[0]);
    console.log("- Symbol:", tokenInfo1[1]);
    console.log("- Treasury:", tokenInfo1[2]);
    console.log("- Total Supply:", tokenInfo1[3].toString());
    
    // Test minting tokens with the contract
    console.log("\nTesting token minting with contract as supply key...");
    const mintAmount = 1000n;
    const mintTx = await minterContract.mintTokens(mintAmount, contractAddress, {
      gasLimit: 1000000,
      gasPrice: ethers.parseUnits("530", "gwei")
    });
    
    console.log("Mint transaction hash:", mintTx.hash);
    console.log("Waiting for transaction confirmation...");
    
    const mintReceipt = await mintTx.wait();
    console.log("Mint transaction confirmed in block:", mintReceipt?.blockNumber);
    
    // Parse events
    const events = mintReceipt?.logs
      .filter((log: Log) => log.address === contractAddress)
      .map((log: Log) => {
        try {
          return TestHTSMinter.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
        } catch (e: unknown) {
          return null;
        }
      })
      .filter(Boolean);
    
    console.log("Events:", events?.map(e => ({ name: e?.name, args: e?.args })));
    
    // Check balance after minting
    const balance = await minterContract.getTokenBalance();
    console.log("Token balance after minting:", balance.toString());
    
    // Also verify with Hedera SDK via token info
    const tokenInfoQuery = new TokenInfoQuery()
      .setTokenId(tokenId);
    
    const fetchedTokenInfo = await tokenInfoQuery.execute(client);
    console.log("\nToken info from Hedera SDK:");
    console.log("- Name:", fetchedTokenInfo.name);
    console.log("- Symbol:", fetchedTokenInfo.symbol);
    console.log("- Total Supply:", fetchedTokenInfo.totalSupply.toString());
    
    console.log("\nHybrid solution test complete!");
    console.log("- Token created successfully with SDK");
    console.log("- Contract successfully minted tokens");
    console.log("- Contract has the correct supply key permissions");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Convert EVM address (0x...) to Hedera Contract ID format (0.0.X)
function convertEvmAddressToContractId(evmAddress: string): string {
  // Remove 0x prefix if present
  const address = evmAddress.startsWith("0x") ? evmAddress.slice(2) : evmAddress;
  
  // This is a placeholder - ideally you'd query the mirror node
  const contractIdLong = BigInt("0x" + address);
  
  // Format as 0.0.X
  return `0.0.${contractIdLong}`;
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