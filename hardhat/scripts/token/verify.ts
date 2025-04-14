import { ethers } from "hardhat";
import path from 'path';
import fs from 'fs';

// Helper function to get deployment info
function getDeploymentInfo(): any {
  const deploymentInfoPath = path.join(__dirname, '../../../deployment-info.json');
  return require(deploymentInfoPath);
}

// Helper function to convert Hedera ID to EVM address
function hederaIdToEvmAddress(hederaId: string): string {
  const accountNum = hederaId.split('.').pop() || "0";
  // Use BigInt for proper handling of large numbers
  const accountBigInt = BigInt(accountNum);
  const paddedAccountNum = accountBigInt.toString(16).padStart(40, '0');
  return `0x${paddedAccountNum}`;
}

async function main() {
  // Get deployment info
  const deploymentInfo = getDeploymentInfo();
  const controllerId = deploymentInfo.controllerId;
  const tokenAddress = deploymentInfo.tokenAddress;
  
  console.log(`Controller ID: ${controllerId}`);
  
  // Convert Hedera ID to EVM address
  const controllerAddress = hederaIdToEvmAddress(controllerId);
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
      
      // Convert to Hedera ID format for environment variables
      const tokenAddressHex = tokenAddress.replace("0x", "");
      const tokenNum = BigInt(`0x${tokenAddressHex}`);
      const tokenId = `0.0.${tokenNum.toString()}`;
      
      console.log("\nFor your .env.local file:");
      console.log(`NEXT_PUBLIC_LYNX_CONTRACT_ID=${controllerId}`);
      console.log(`NEXT_PUBLIC_LYNX_TOKEN_ID=${tokenId}`);
    } else {
      console.log("Token is not created yet.");
    }
  } catch (error: any) {
    console.error("Error checking token status:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: any) => {
    console.error(error);
    process.exit(1);
  }); 