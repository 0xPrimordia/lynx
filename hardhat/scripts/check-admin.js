const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Get deployment info
  const deploymentInfoPath = path.join(__dirname, "../deployment-info.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, "utf-8"));
  const controllerAddress = deploymentInfo.controllerEvm;
  
  console.log(`Controller EVM Address: ${controllerAddress}`);
  
  // Create contract instance
  const controller = await ethers.getContractAt("IndexTokenController", controllerAddress);
  
  // Get the ADMIN address
  const admin = await controller.ADMIN();
  console.log(`ADMIN address: ${admin}`);
  
  // Get the first signer (the one used in deployment)
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  
  // Check if they match
  console.log(`Are they the same? ${admin.toLowerCase() === deployer.address.toLowerCase()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 