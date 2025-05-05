import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("SETTING TOKEN ID IN CONTROLLER");
  console.log("===============================");
  
  // Load deployment info
  const deploymentPath = path.join(__dirname, "../../deployment-info.json");
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const controllerAddress = deploymentInfo.controllerEvm;
  const tokenAddress = deploymentInfo.tokenAddress;
  const tokenId = deploymentInfo.tokenId;
  
  if (!controllerAddress) {
    throw new Error("Controller address not found in deployment info");
  }
  
  if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Token address not found in deployment info. Run create-token-sdk.ts first");
  }
  
  console.log(`Controller address: ${controllerAddress}`);
  console.log(`Token address: ${tokenAddress}`);
  console.log(`Token ID: ${tokenId}`);
  
  // Connect to controller contract
  const controller = await ethers.getContractAt("IndexTokenController", controllerAddress);
  
  // Check if token is already set
  const currentTokenAddress = await controller.INDEX_TOKEN();
  if (currentTokenAddress !== "0x0000000000000000000000000000000000000000") {
    console.log(`Index token is already set to ${currentTokenAddress}`);
    console.log("No action needed. Exiting...");
    return;
  }
  
  // Set token ID in controller
  console.log("Setting token ID in controller...");
  
  try {
    const tx = await controller.setIndexTokenId(tokenAddress, {
      gasLimit: 1000000,
      gasPrice: ethers.parseUnits("530", "gwei")
    });
    
    console.log(`Transaction hash: ${tx.hash}`);
    console.log("Waiting for transaction confirmation...");
    
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    
    // Verify token is set
    const updatedTokenAddress = await controller.INDEX_TOKEN();
    console.log(`Updated token address: ${updatedTokenAddress}`);
    
    if (updatedTokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
      console.log("✅ Token ID successfully set in controller");
      
      // Check if controller has supply key
      const hasSupplyKey = await controller.hasSupplyKey();
      console.log(`Controller has supply key: ${hasSupplyKey}`);
      
      if (hasSupplyKey) {
        console.log("✅ Controller has supply key - token creation successful");
      } else {
        console.log("❌ Controller does not have supply key - check configuration");
      }
    } else {
      console.log("❌ Failed to set token ID in controller");
    }
  } catch (error) {
    console.error("Error setting token ID in controller:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 