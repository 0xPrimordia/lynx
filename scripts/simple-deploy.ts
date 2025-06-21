import "@nomicfoundation/hardhat-ethers";
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
  console.log("🚀 Simple deployment test...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} HBAR`);

  try {
    // Try to compile and get contract factories first
    console.log("📋 Getting contract factories...");
    const IndexVault = await ethers.getContractFactory("IndexVault");
    console.log("✅ IndexVault factory created");
    
    const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
    console.log("✅ IndexTokenController factory created");
    
    // Check what constructor parameters are expected
    console.log("\n🔍 Checking contract interfaces...");
    console.log("IndexVault interface:", IndexVault.interface.deploy);
    console.log("IndexTokenController interface:", IndexTokenController.interface.deploy);
    
  } catch (error) {
    console.error("💥 Error getting contract factories:", error);
  }
}

main().catch(console.error); 