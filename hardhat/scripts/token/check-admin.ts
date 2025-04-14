import { Client, AccountId, PrivateKey, ContractCallQuery, ContractId } from "@hashgraph/sdk";
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
    console.log("Checking if operator is admin of the controller...");
    
    // Validate environment
    const { operatorId, operatorKey } = validateEnv();
    console.log(`Operator ID: ${operatorId}`);
    
    // Initialize Hedera client
    const client = Client.forTestnet();
    
    // Set up client operator account
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    // Get deployment info
    const deploymentInfo = getDeploymentInfo();
    const controllerEvm = deploymentInfo.controllerEvm;
    console.log(`Controller EVM address: ${controllerEvm}`);
    
    // Get controller info
    const contractId = ContractId.fromEvmAddress(0, 0, controllerEvm);
    
    // Get ADMIN from controller
    const adminQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction("ADMIN");
    
    const adminResult = await adminQuery.execute(client);
    const adminBytes = adminResult.getAddress();
    const adminAddress = `0x${Buffer.from(adminBytes).toString('hex')}`;
    console.log(`Admin address: ${adminAddress}`);
    
    // Get operator account as EVM address
    // In Hedera, Account ID 0.0.X corresponds to EVM address 0x000...00X (padded to 40 chars)
    const operatorNum = operatorId.split('.').pop() || "0";
    const paddedOperatorNum = operatorNum.padStart(40, '0');
    const operatorEvmAddress = `0x${paddedOperatorNum}`;
    console.log(`Operator EVM address: ${operatorEvmAddress}`);
    
    // Check if operator is admin
    if (adminAddress.toLowerCase() === operatorEvmAddress.toLowerCase()) {
      console.log("✅ Operator IS the admin of the controller");
    } else {
      console.log("❌ Operator is NOT the admin of the controller");
      console.log("This is likely why token creation is failing - only admin can create tokens.");
    }
    
  } catch (error) {
    console.error("Error checking admin status:", error);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 