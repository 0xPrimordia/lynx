import {
  Client,
  AccountId,
  PrivateKey,
  ContractCallQuery,
  ContractId
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

// Helper function to get deployment info
function getDeploymentInfo(): any {
  const deploymentInfoPath = path.join(__dirname, "../../../deployment-info.json");
  return require(deploymentInfoPath);
}

// Helper function to save deployment info
function saveDeploymentInfo(info: any): void {
  const deploymentInfoPath = path.join(__dirname, "../../../deployment-info.json");
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(info, null, 2));
}

// Convert address bytes to Hedera ID format
function addressBytesToHederaId(bytes: Uint8Array): string {
  // Convert to hex string and remove leading zeros
  const hex = Buffer.from(bytes).toString('hex').replace(/^0+/, '');
  // Parse as BigInt instead of integer to handle large numbers correctly
  const num = BigInt(`0x${hex}`);
  // Format as 0.0.num
  return `0.0.${num.toString()}`;
}

// Validate environment variables
function validateEnv() {
  const requiredEnvVars = ["NEXT_PUBLIC_OPERATOR_ID", "OPERATOR_KEY"];
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  
  return {
    operatorId: process.env.NEXT_PUBLIC_OPERATOR_ID || "",
    operatorKey: process.env.OPERATOR_KEY || "",
  };
}

async function main() {
  try {
    console.log("Starting token verification with Hedera SDK...");
    
    // Validate environment
    const { operatorId, operatorKey } = validateEnv();
    console.log(`Using operator: ${operatorId}`);
    
    // Initialize Hedera client
    const client = Client.forTestnet();
    console.log("Initialized Hedera testnet client");
    
    // Set up client operator account
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    console.log("Set operator account for client");
    
    // Get deployment info
    const deploymentInfo = getDeploymentInfo();
    const controllerId = deploymentInfo.controllerId;
    console.log(`Controller ID: ${controllerId}`);
    
    // Query token address
    console.log("Checking token address...");
    const contractId = ContractId.fromString(controllerId);
    
    const tokenQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction("getTokenAddress");
    
    const tokenQueryResult = await tokenQuery.execute(client);
    const tokenAddressBytes = tokenQueryResult.asBytes();
    
    // Check if all bytes are zero (indicating no token)
    const isAllZeros = tokenAddressBytes.every((byte: number) => byte === 0);
    
    if (isAllZeros) {
      console.log("No token found. Token has not been created yet.");
      return;
    }
    
    // Convert to hex address format
    const tokenAddressHex = `0x${Buffer.from(tokenAddressBytes).toString('hex')}`;
    console.log(`Token address: ${tokenAddressHex}`);
    
    // Convert to Hedera ID format
    const tokenId = addressBytesToHederaId(tokenAddressBytes);
    console.log(`Token ID: ${tokenId}`);
    
    // Check if controller has supply key
    console.log("Checking if controller has supply key...");
    const supplyKeyQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction("hasSupplyKey");
    
    const supplyKeyResult = await supplyKeyQuery.execute(client);
    const hasSupplyKey = supplyKeyResult.getBool();
    console.log(`Controller has supply key: ${hasSupplyKey}`);
    
    // Update deployment info if token address has changed
    if (deploymentInfo.tokenAddress !== tokenAddressHex) {
      deploymentInfo.tokenAddress = tokenAddressHex;
      saveDeploymentInfo(deploymentInfo);
      console.log("Updated deployment-info.json with token address");
    }
    
    // Print environment variable values for .env.local
    console.log("\nFor your .env.local file:");
    console.log(`NEXT_PUBLIC_LYNX_CONTRACT_ID=${controllerId}`);
    console.log(`NEXT_PUBLIC_LYNX_TOKEN_ID=${tokenId}`);
    
    console.log("\nVerification complete");
  } catch (error) {
    console.error("Error in token verification process:", error);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 