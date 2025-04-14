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
  const paddedAccountNum = accountNum.padStart(40, '0');
  return `0x${paddedAccountNum}`;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Funding from account:", signer.address);
  
  // Get deployment info
  const deploymentInfo = getDeploymentInfo();
  const controllerId = deploymentInfo.controllerId;
  
  // Convert Hedera ID to EVM address
  const controllerAddress = hederaIdToEvmAddress(controllerId);
  
  console.log(`Controller ID: ${controllerId}`);
  console.log(`Controller Address: ${controllerAddress}`);
  
  // Send 5 HBAR to the controller contract
  const amountToSend = ethers.parseEther("5.0");
  console.log(`Sending ${ethers.formatEther(amountToSend)} HBAR to controller...`);
  
  const tx = await signer.sendTransaction({
    to: controllerAddress,
    value: amountToSend
  });
  
  console.log(`Transaction hash: ${tx.hash}`);
  await tx.wait();
  console.log("Transaction confirmed!");
}

main()
  .then(() => process.exit(0))
  .catch((error: any) => {
    console.error(error);
    process.exit(1);
  }); 