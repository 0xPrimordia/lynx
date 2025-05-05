import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying TestHTS contract...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "HBAR");
  
  // Deploy TestHTS contract
  const TestHTS = await ethers.getContractFactory("TestHTS");
  const testHTS = await TestHTS.deploy({
    gasLimit: 400000,
    gasPrice: ethers.parseUnits("530", "gwei")
  });
  
  console.log("Waiting for deployment...");
  await testHTS.waitForDeployment();
  
  const testHTSAddress = await testHTS.getAddress();
  console.log("TestHTS deployed to:", testHTSAddress);
  
  // Save deployment info to a file
  const deploymentInfo = {
    testHTSAddress: testHTSAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString()
  };
  
  const debugDeploymentPath = path.join(__dirname, "../../debug-deployment-info.json");
  fs.writeFileSync(debugDeploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Debug deployment info saved to:", debugDeploymentPath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 