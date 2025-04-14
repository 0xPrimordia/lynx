import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  try {
    // Get deployment info
    const deploymentInfo = require('../deployment-info.json');
    const controllerId = deploymentInfo.controllerId;
    
    // Convert Hedera ID to EVM address
    const accountNum = controllerId.split('.').pop() || "0";
    // Use BigInt for large account numbers and ensure proper padding
    const accountBigInt = BigInt(accountNum);
    const paddedAccountNum = accountBigInt.toString(16).padStart(40, '0');
    const controllerAddress = `0x${paddedAccountNum}`;
    
    console.log(`Controller ID: ${controllerId}`);
    console.log(`Controller Address: ${controllerAddress}`);
    
    // Get contract instance
    const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
    const controller = IndexTokenController.attach(controllerAddress);
    
    // Try to check token address via direct call
    console.log("Checking token address directly from contract storage...");
    
    // Use a low-level call to get the INDEX_TOKEN variable value from storage
    // This is a direct storage access approach that bypasses function calls
    const provider = ethers.provider;
    const indexTokenSlot = "0x0"; // Assuming INDEX_TOKEN is the first storage variable
    
    try {
      const tokenAddressHex = await provider.getStorage(controllerAddress, indexTokenSlot);
      const tokenAddress = ethers.getAddress(tokenAddressHex);
      console.log(`Token address from storage: ${tokenAddress}`);
      
      if (tokenAddress !== "0x0000000000000000000000000000000000000000") {
        console.log("Valid token address found in contract storage!");
        
        // Update deployment info
        deploymentInfo.tokenAddress = tokenAddress;
        fs.writeFileSync('./deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
        console.log("Deployment info updated with token address");
      } else {
        console.log("No token has been created yet (address is zero)");
      }
    } catch (error) {
      console.error("Error accessing contract storage:", error.message);
    }
    
    // Try to call the contract method directly
    try {
      const tokenAddressFromMethod = await controller.getTokenAddress();
      console.log(`Token address from method call: ${tokenAddressFromMethod}`);
    } catch (error) {
      console.error("Error calling getTokenAddress:", error.message);
    }
    
    // Check supply key status
    try {
      const hasSupplyKey = await controller.hasSupplyKey();
      console.log(`Has supply key: ${hasSupplyKey}`);
    } catch (error) {
      console.error("Error checking supply key status:", error.message);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 