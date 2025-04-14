import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Get deployment info
  const deploymentInfoPath = path.join(__dirname, "../../../deployment-info.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, "utf8"));
  
  // Get controller contract
  const controller = await ethers.getContractAt(
    "IndexTokenController",
    deploymentInfo.controllerEvm
  );
  
  console.log("Checking token state...");
  
  // Check if token exists
  try {
    const tokenAddress = await controller.INDEX_TOKEN();
    console.log("Token address:", tokenAddress);
    console.log("Is zero address:", tokenAddress === ethers.ZeroAddress);
  } catch (error: any) {
    console.error("Error reading token address:", error.message);
  }
  
  // Check admin
  try {
    const admin = await controller.ADMIN();
    console.log("Admin address:", admin);
  } catch (error: any) {
    console.error("Error reading admin:", error.message);
  }
  
  // Check vault
  try {
    const vault = await controller.vault();
    console.log("Vault address:", vault);
  } catch (error: any) {
    console.error("Error reading vault:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 