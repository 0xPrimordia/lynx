import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { Contract } from "ethers";

/**
 * Token Creation Script using Hardhat Ethers
 * 
 * This script creates the Lynx Index Token using the same account that deployed the contract.
 * This ensures the ADMIN check passes in the onlyAdmin modifier.
 */

// Helper function to get deployment info
function getDeploymentInfo(): any {
  const deploymentInfoPath = path.join(__dirname, "../../../deployment-info.json");
  return require(deploymentInfoPath);
}

// Helper function to save deployment info
function saveDeploymentInfo(info: any): void {
  const deploymentInfoPath = path.join(__dirname, "../../../deployment-info.json");
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(info, null, 2));
}

// Helper function to update .env.local with token ID
function updateEnvWithTokenId(tokenAddress: string): void {
  // Convert EVM address to Hedera ID format
  const tokenAddressHex = tokenAddress.replace('0x', '');
  const tokenNum = BigInt(`0x${tokenAddressHex}`);
  const tokenId = `0.0.${tokenNum.toString()}`;
  
  const envFilePath = path.join(__dirname, '../../../.env.local');
  
  // Read current .env.local file if it exists
  let envContent = '';
  try {
    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, 'utf8');
    }
  } catch (error) {
    console.warn("Could not read existing .env.local file. Creating new one.");
  }
  
  // Update or add environment variables
  const envVars = envContent.split('\n');
  const updatedVars: string[] = [];
  let tokenIdUpdated = false;
  
  // Update existing variables
  for (const line of envVars) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      updatedVars.push(line); // Keep comments and empty lines
      continue;
    }
    
    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmedLine.substring(0, equalIndex);
      if (key === 'NEXT_PUBLIC_LYNX_TOKEN_ID') {
        updatedVars.push(`NEXT_PUBLIC_LYNX_TOKEN_ID=${tokenId}`);
        tokenIdUpdated = true;
      } else {
        updatedVars.push(line); // Keep unchanged line
      }
    } else {
      updatedVars.push(line); // Keep line without equals
    }
  }
  
  // Add token ID if not already in the file
  if (!tokenIdUpdated) {
    updatedVars.push(`NEXT_PUBLIC_LYNX_TOKEN_ID=${tokenId}`);
  }
  
  // Write updated content back to file
  fs.writeFileSync(envFilePath, updatedVars.join('\n'));
  console.log(`Updated .env.local with token ID: ${tokenId}`);
}

async function main() {
  console.log("Creating token with Hardhat Ethers...");
  
  // Get the same signer used for deployment (first account)
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "HBAR");
  
  // Get deployment info
  const deploymentInfo = getDeploymentInfo();
  const controllerAddress = deploymentInfo.controllerEvm;
  
  console.log(`Controller EVM Address: ${controllerAddress}`);
  
  // Create contract instance
  const controller = await ethers.getContractAt("IndexTokenController", controllerAddress, deployer);
  
  // Token parameters
  const name = "Lynx Index Token";
  const symbol = "LYNX";
  const memo = "Lynx Index Token";
  
  console.log("Token parameters:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Memo:", memo);
  
  // Check if token already exists
  console.log("\nChecking if token already exists...");
  const currentToken = await controller.getTokenAddress();
  
  if (currentToken !== ethers.ZeroAddress) {
    console.log(`Token already exists at: ${currentToken}`);
    
    // Update deployment info
    deploymentInfo.tokenAddress = currentToken;
    saveDeploymentInfo(deploymentInfo);
    console.log("Deployment info updated with existing token address");
    
    // Update .env.local
    updateEnvWithTokenId(currentToken);
    return;
  }
  
  console.log("No existing token found. Creating new token...");
  
  try {
    // Create token with more HBAR and higher gas limit
    const tx = await controller.createIndexToken(name, symbol, memo, {
      value: ethers.parseEther("10.0"),
      gasLimit: 4000000,
      gasPrice: ethers.parseUnits("600", "gwei")
    });
    
    console.log(`Transaction hash: ${tx.hash}`);
    console.log("Waiting for transaction confirmation...");
    
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    
    // Get token address
    const tokenAddress = await controller.getTokenAddress();
    
    if (tokenAddress !== ethers.ZeroAddress) {
      console.log(`Token created successfully at: ${tokenAddress}`);
      
      // Update deployment info
      deploymentInfo.tokenAddress = tokenAddress;
      saveDeploymentInfo(deploymentInfo);
      console.log("Deployment info updated with token address");
      
      // Update .env.local
      updateEnvWithTokenId(tokenAddress);
      
      // Check supply key
      const hasSupplyKey = await controller.hasSupplyKey();
      console.log(`Controller has supply key: ${hasSupplyKey}`);
    } else {
      console.log("Token creation failed - no token address found");
    }
  } catch (error: any) {
    console.error("Error creating token:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: any) => {
    console.error(error);
    process.exit(1);
  }); 