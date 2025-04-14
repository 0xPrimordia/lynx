import { ethers } from "hardhat";

async function main() {
  // Get deployment info
  const deploymentInfo = require('../deployment-info.json');
  const controllerId = deploymentInfo.controllerId;
  
  // Convert Hedera ID to EVM address
  const accountNum = controllerId.split('.').pop();
  const paddedAccountNum = accountNum.padStart(40, '0');
  const controllerAddress = `0x${paddedAccountNum}`;
  
  console.log(`Controller ID: ${controllerId}`);
  console.log(`Controller Address: ${controllerAddress}`);
  
  // Load contract ABI
  const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
  const controller = IndexTokenController.attach(controllerAddress);
  
  try {
    // Check if token is already created
    const tokenAddress = await controller.getTokenAddress();
    console.log(`Token address: ${tokenAddress}`);
    
    if (tokenAddress && tokenAddress !== ethers.ZeroAddress) {
      console.log("Token is already created!");
      console.log(`Has supply key: ${await controller.hasSupplyKey()}`);
    } else {
      console.log("Token is not created yet.");
    }
  } catch (error) {
    console.error("Error checking token status:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 