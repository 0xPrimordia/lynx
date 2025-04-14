import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Get the deployer account (Account #0 from hardhat)
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer account:", deployer.address);
  
  // Get deployment info
  const deploymentInfoPath = path.join(__dirname, "../../../deployment-info.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, "utf8"));
  
  // Deploy MockHTS
  console.log("Deploying MockHTS...");
  const MockHTS = await ethers.getContractFactory("MockHederaTokenService");
  const mockHTS = await MockHTS.deploy();
  await mockHTS.waitForDeployment();
  const mockHTSAddress = await mockHTS.getAddress();
  console.log("MockHTS deployed to:", mockHTSAddress);
  
  // Get controller contract
  const controller = await ethers.getContractAt(
    "IndexTokenController",
    deploymentInfo.controllerEvm,
    deployer
  );
  
  // Set mock HTS in controller
  console.log("Setting mock HTS in controller...");
  const tx1 = await controller.setTokenService(mockHTSAddress);
  await tx1.wait();
  console.log("Mock HTS set in controller");
  
  // Get vault contract
  const vault = await ethers.getContractAt(
    "IndexVault",
    deploymentInfo.vaultEvm,
    deployer
  );
  
  // Associate vault with mock HTS
  console.log("Associating vault with mock HTS...");
  const tx2 = await mockHTS.associateToken(deploymentInfo.vaultEvm, mockHTSAddress);
  await tx2.wait();
  console.log("Vault associated with mock HTS");
  
  // Update deployment info
  deploymentInfo.mockHTSAddress = mockHTSAddress;
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Updated deployment-info.json with mock HTS address");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 