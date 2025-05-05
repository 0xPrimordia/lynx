import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "HBAR");
  
  // Get test contract addresses
  const debugDeploymentPath = path.join(__dirname, "../../debug-deployment-info.json");
  if (!fs.existsSync(debugDeploymentPath)) {
    console.error("Debug deployment info not found. Please run deploy-test-hts.ts first.");
    return;
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync(debugDeploymentPath, "utf8"));
  
  if (!deploymentInfo.combinedKeyTestAddress) {
    console.error("Combined key test contract address not found.");
    return;
  }
  
  const combinedKeyTestAddress = deploymentInfo.combinedKeyTestAddress;
  console.log("Funding contract:", combinedKeyTestAddress);
  
  // Send HBAR to contract
  const amountToSend = ethers.parseEther("5.0");
  const tx = await deployer.sendTransaction({
    to: combinedKeyTestAddress,
    value: amountToSend,
    gasLimit: 100000,
    gasPrice: ethers.parseUnits("530", "gwei")
  });
  
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");
  
  await tx.wait();
  console.log("Transaction confirmed!");
  
  // Check balances after transfer
  const newBalance = await deployer.provider.getBalance(deployer.address);
  console.log("New account balance:", ethers.formatEther(newBalance), "HBAR");
  
  const contractBalance = await deployer.provider.getBalance(combinedKeyTestAddress);
  console.log("New contract balance:", ethers.formatEther(contractBalance), "HBAR");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 