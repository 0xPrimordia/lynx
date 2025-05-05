import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ContractId } from "@hashgraph/sdk";

const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";

function saveDeploymentInfo(info: any): void {
  const deploymentInfoPath = path.join(__dirname, "../../deployment-info.json");
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(info, null, 2));
  console.log(`Deployment info saved to ${deploymentInfoPath}`);
}

async function main() {
  console.log("SIMPLE DEPLOYMENT SCRIPT");
  console.log("========================");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} HBAR`);
  
  // Deploy Vault
  console.log("\n1. Deploying IndexVault...");
  const IndexVault = await ethers.getContractFactory("IndexVault");
  
  console.log("Deploying vault with parameters:");
  console.log(`- Admin: ${deployer.address}`);
  console.log(`- HTS Address: ${HTS_PRECOMPILE}`);
  
  const vault = await IndexVault.deploy(
    deployer.address, // admin
    HTS_PRECOMPILE,   // HTS precompile
    {
      gasLimit: 800000,
      gasPrice: ethers.parseUnits("600", "gwei")
    }
  );
  
  console.log("Waiting for vault deployment...");
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`IndexVault deployed to: ${vaultAddress}`);
  
  // Deploy Controller
  console.log("\n2. Deploying IndexTokenController...");
  const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
  
  console.log("Deploying controller with parameters:");
  console.log(`- Vault Address: ${vaultAddress}`);
  console.log(`- HTS Address: ${HTS_PRECOMPILE}`);
  
  const controller = await IndexTokenController.deploy(
    vaultAddress,    // vault address
    HTS_PRECOMPILE,  // HTS precompile
    {
      gasLimit: 800000,
      gasPrice: ethers.parseUnits("600", "gwei")
    }
  );
  
  console.log("Waiting for controller deployment...");
  await controller.waitForDeployment();
  const controllerAddress = await controller.getAddress();
  console.log(`IndexTokenController deployed to: ${controllerAddress}`);
  
  // Set controller in vault
  console.log("\n3. Setting controller in vault...");
  const tx = await vault.setController(
    controllerAddress,
    {
      gasLimit: 200000,
      gasPrice: ethers.parseUnits("600", "gwei")
    }
  );
  
  console.log("Waiting for transaction confirmation...");
  const receipt = await tx.wait();
  console.log(`Transaction confirmed: ${receipt?.hash}`);
  console.log("Controller set in vault!");
  
  // Verify setup
  console.log("\n4. Verifying deployment...");
  
  const vaultAdmin = await vault.admin();
  console.log(`Vault admin: ${vaultAdmin}`);
  
  const vaultController = await vault.controller();
  console.log(`Vault controller: ${vaultController}`);
  
  const controllerAdmin = await controller.ADMIN();
  console.log(`Controller admin: ${controllerAdmin}`);
  
  // Save deployment info
  const vaultId = ContractId.fromSolidityAddress(vaultAddress).toString();
  const controllerId = ContractId.fromSolidityAddress(controllerAddress).toString();
  
  const deploymentInfo = {
    vaultId,
    controllerId,
    vaultEvm: vaultAddress,
    controllerEvm: controllerAddress,
    tokenAddress: "0x0000000000000000000000000000000000000000",
    deploymentTimestamp: new Date().toISOString()
  };
  
  saveDeploymentInfo(deploymentInfo);
  
  console.log("\nDEPLOYMENT SUCCESSFUL!");
  console.log("======================");
  console.log(`Vault ID: ${vaultId}`);
  console.log(`Controller ID: ${controllerId}`);
  
  console.log("\nNext steps:");
  console.log("1. Fund the controller with HBAR for token creation");
  console.log("2. Create tokens for the composition");
  console.log("3. Create the index token");
  console.log("4. Test minting with deposits");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  }); 