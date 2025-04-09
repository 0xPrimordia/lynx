import { ethers } from "hardhat";
import { HederaManager } from "../utils/hedera";

async function main() {
  console.log("🚀 Deploying IndexVault...");
  
  // Get the Hedera client
  const hedera = HederaManager.getInstance();
  
  // Check operator balance
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  if (!operatorId) throw new Error("Missing operator ID");
  
  const balance = await hedera.checkBalance(operatorId);
  console.log(`Operator balance: ${balance.toString()}`);
  
  // Deploy the contract
  const IndexVault = await ethers.getContractFactory("IndexVault");
  const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  console.log("Deploying contract...");
  const vault = await IndexVault.deploy(PLACEHOLDER_ADDRESS);
  
  console.log("Waiting for deployment...");
  await vault.deployed();
  
  console.log(`✅ IndexVault deployed to: ${vault.address}`);
  
  // Save deployment info
  const deploymentInfo = {
    vault: {
      address: vault.address,
      deployer: operatorId,
      timestamp: new Date().toISOString()
    }
  };
  
  console.log("\nDeployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 