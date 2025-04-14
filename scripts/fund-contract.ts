import "@nomicfoundation/hardhat-ethers";
import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Funding from account:", signer.address);
  
  // Get deployment info
  const deploymentInfo = require('../deployment-info.json');
  const controllerId = deploymentInfo.controllerId;
  
  // Convert Hedera ID to EVM address
  const accountNumStr = controllerId.split('.').pop() || "0";
  // Handle the large numbers properly
  const accountNum = BigInt(accountNumStr);
  const paddedAccountNum = accountNum.toString(16).padStart(40, '0');
  const controllerAddress = `0x${paddedAccountNum}`;
  
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
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 