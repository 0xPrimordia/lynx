import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Define the deployment info interface
interface DeploymentInfo {
  testHTSAddress?: string;
  combinedKeyTestAddress?: string;
  deployer?: string;
  deploymentTime?: string;
  [key: string]: any;
}

async function main() {
  console.log("Deploying TestHTSWithCombinedKeys contract...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "HBAR");
  
  // Deploy TestHTSWithCombinedKeys contract
  const TestHTSWithCombinedKeys = await ethers.getContractFactory("TestHTSWithCombinedKeys");
  const testHTS = await TestHTSWithCombinedKeys.deploy({
    gasLimit: 400000,
    gasPrice: ethers.parseUnits("530", "gwei")
  });
  
  console.log("Waiting for deployment...");
  await testHTS.waitForDeployment();
  
  const testHTSAddress = await testHTS.getAddress();
  console.log("TestHTSWithCombinedKeys deployed to:", testHTSAddress);
  
  // Fund the contract with HBAR
  console.log("Funding contract with HBAR...");
  const fundTx = await deployer.sendTransaction({
    to: testHTSAddress,
    value: ethers.parseEther("3.0"),
    gasLimit: 100000,
    gasPrice: ethers.parseUnits("530", "gwei")
  });
  
  console.log("Funding transaction hash:", fundTx.hash);
  await fundTx.wait();
  console.log("Funding complete!");
  
  const contractBalance = await deployer.provider.getBalance(testHTSAddress);
  console.log("Contract balance:", ethers.formatEther(contractBalance), "HBAR");
  
  // Save deployment info to a file
  const debugDeploymentPath = path.join(__dirname, "../../debug-deployment-info.json");
  let deploymentInfo: DeploymentInfo = {};
  
  if (fs.existsSync(debugDeploymentPath)) {
    deploymentInfo = JSON.parse(fs.readFileSync(debugDeploymentPath, "utf8")) as DeploymentInfo;
  }
  
  deploymentInfo.combinedKeyTestAddress = testHTSAddress;
  fs.writeFileSync(debugDeploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Debug deployment info saved to:", debugDeploymentPath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 