import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("SETTING CONTROLLER IN VAULT");
  console.log("===========================");
  
  // Load deployment info
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync("../deployment-info.json", "utf8"));
    console.log("Loaded deployment info:");
    console.log(`- Vault: ${deploymentInfo.vaultEvm}`);
    console.log(`- Controller: ${deploymentInfo.controllerEvm}`);
  } catch (error) {
    console.error("Error loading deployment info:", error);
    process.exit(1);
  }
  
  // Connect to contracts
  const [deployer] = await ethers.getSigners();
  console.log(`\nUsing account: ${deployer.address}`);
  
  const IndexVault = await ethers.getContractFactory("IndexVault");
  const vault = await IndexVault.attach(deploymentInfo.vaultEvm);
  
  console.log(`\nSetting controller ${deploymentInfo.controllerEvm} in vault ${deploymentInfo.vaultEvm}...`);
  
  try {
    // Check admin
    const admin = await vault.admin();
    console.log(`Vault admin: ${admin}`);
    
    if (admin.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error(`Account ${deployer.address} is not the admin of the vault (${admin})`);
      process.exit(1);
    }
    
    // Set controller
    console.log("Sending setController transaction...");
    const tx = await vault.setController(deploymentInfo.controllerEvm, {
      gasLimit: 200000,
      gasPrice: ethers.parseUnits("600", "gwei")
    });
    
    console.log(`Transaction sent: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Verify
    const controller = await vault.controller();
    console.log(`\nNew controller address in vault: ${controller}`);
    
    if (controller.toLowerCase() === deploymentInfo.controllerEvm.toLowerCase()) {
      console.log("\nController successfully set! ✅");
    } else {
      console.error("\nController not set correctly ❌");
    }
  } catch (error) {
    console.error("Error setting controller:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  }); 