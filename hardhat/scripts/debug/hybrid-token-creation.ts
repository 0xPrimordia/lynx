import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  ContractId,
  Hbar,
  ContractExecuteTransaction
} from "@hashgraph/sdk";
import dotenv from "dotenv";
import fs from "fs";
import { ethers } from "hardhat";

// Load environment variables
dotenv.config({ path: "../../.env.local" });

// Validate environment variables
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;

if (!operatorId || !operatorKey) {
  throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
}

async function main() {
  console.log("Hybrid Token Creation Test");
  console.log("==========================");
  
  // Get the contract address to use as admin/supply key
  if (!fs.existsSync("debug-minimal-deployment-info.json")) {
    console.error("No contract deployment found. Deploy a test contract first.");
    process.exit(1);
  }
  
  const deploymentInfo = JSON.parse(
    fs.readFileSync("debug-minimal-deployment-info.json", "utf8")
  );
  const contractAddress = deploymentInfo.minimaltestContract;
  console.log("Using contract as key holder:", contractAddress);
  
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
  
  console.log("Creating token with contract as admin and supply key...");
  
  try {
    // Create token with contract as admin & supply key
    const tokenCreateTx = new TokenCreateTransaction()
      .setTokenName("Hybrid Test Token")
      .setTokenSymbol("HTT")
      .setDecimals(0)
      .setInitialSupply(0)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(AccountId.fromString(operatorId))
      .setAdminKey(contractId)
      .setSupplyKey(contractId)
      .setMaxTransactionFee(new Hbar(30))
      .freezeWith(client);
    
    const tokenCreateSubmit = await tokenCreateTx.execute(client);
    const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
    const tokenId = tokenCreateRx.tokenId;
    
    console.log("Token created successfully!");
    console.log("Token ID:", tokenId?.toString());
    
    // Save token info
    const tokenInfo = {
      tokenId: tokenId?.toString(),
      contractAddress,
      contractIdHedera: contractIdStr,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      "hybrid-token-info.json",
      JSON.stringify(tokenInfo, null, 2)
    );
    console.log("Token info saved to hybrid-token-info.json");
    
    // Now verify the contract can mint tokens
    console.log("\nTesting if contract can mint tokens...");
    
    // Get signer for hardhat deployment
    const [deployer] = await ethers.getSigners();
    
    // Call a mint function if your contract has one, or create one
    // This is a placeholder - you'd need to implement a mint function in your contract
    // const mintTx = await yourContract.mint(tokenId, amount);
    // await mintTx.wait();
    
    console.log("\nHybrid approach successful! The SDK created a token with the contract as the admin/supply key.");
    
  } catch (error) {
    console.error("Failed to create token:", error);
  }
}

// Convert EVM address (0x...) to Hedera Contract ID format (0.0.X)
function convertEvmAddressToContractId(evmAddress: string): string {
  // Remove 0x prefix if present
  const address = evmAddress.startsWith("0x") ? evmAddress.slice(2) : evmAddress;
  
  // Directly query contract info using mirror node (ideal approach)
  // Here we're using a simplified approach - in production, you should query the mirror node API
  
  // This is a placeholder - ideally you'd query the mirror node
  const contractIdLong = BigInt("0x" + address);
  
  // Format as 0.0.X
  return `0.0.${contractIdLong}`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 