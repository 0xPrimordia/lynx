import { 
  Client, 
  AccountId, 
  PrivateKey, 
  ContractExecuteTransaction, 
  ContractId,
  ContractCallQuery,
  Hbar 
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
    console.log("Starting admin transfer process...");
    
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
    
    // First, check who the current admin is
    const adminQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction("ADMIN");
    
    const adminResult = await adminQuery.execute(client);
    const adminBytes = adminResult.getAddress();
    const adminAddress = `0x${Buffer.from(adminBytes).toString('hex')}`;
    console.log(`Current admin address: ${adminAddress}`);
    
    // Get operator account as EVM address
    const operatorNum = operatorId.split('.').pop() || "0";
    const paddedOperatorNum = operatorNum.padStart(40, '0');
    const operatorEvmAddress = `0x${paddedOperatorNum}`;
    console.log(`Operator EVM address: ${operatorEvmAddress}`);
    
    // Check if operator is already admin
    if (adminAddress.toLowerCase() === operatorEvmAddress.toLowerCase()) {
      console.log("✅ Operator is already the admin of the controller, no need to transfer.");
      return;
    }
    
    // Need to transfer admin rights - this will likely fail unless the current operator is the admin
    console.log("\nAttempting to transfer admin rights to current operator...");
    
    // Note: The controller would need a function like updateAdmin or transferAdmin for this to work
    console.log("❌ Cannot transfer admin rights automatically - the controller likely needs:");
    console.log("1. A transferAdmin or updateAdmin function");
    console.log("2. The current admin to call this function");
    
    console.log("\nPossible solutions:");
    console.log("1. Use the account that originally deployed the controller to create the token");
    console.log("2. Update your .env.local file to use the admin account's credentials");
    console.log("3. Redeploy the controller with the current operator as admin");
    
  } catch (error) {
    console.error("Error in admin transfer process:", error);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 