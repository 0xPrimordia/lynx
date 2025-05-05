import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HBAR");
  
  // Get test contract addresses
  const debugDeploymentPath = path.join(__dirname, "../../debug-deployment-info.json");
  if (fs.existsSync(debugDeploymentPath)) {
    const deploymentInfo = JSON.parse(fs.readFileSync(debugDeploymentPath, "utf8"));
    
    if (deploymentInfo.testHTSAddress) {
      const testHTSBalance = await deployer.provider.getBalance(deploymentInfo.testHTSAddress);
      console.log("TestHTS contract balance:", ethers.formatEther(testHTSBalance), "HBAR");
    }
    
    if (deploymentInfo.combinedKeyTestAddress) {
      const combinedKeyBalance = await deployer.provider.getBalance(deploymentInfo.combinedKeyTestAddress);
      console.log("TestHTSWithCombinedKeys contract balance:", ethers.formatEther(combinedKeyBalance), "HBAR");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 