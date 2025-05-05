import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  console.log("Deploying TestHTSMinter contract...");

  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HBAR");

  // Deploy the TestHTSMinter contract
  const TestHTSMinter = await ethers.getContractFactory("TestHTSMinter");
  const testHTSMinter = await TestHTSMinter.deploy({
    gasLimit: 1000000,
    gasPrice: ethers.parseUnits("530", "gwei"), // 530 gwei minimum for Hedera
  });

  await testHTSMinter.waitForDeployment();
  const contractAddress = await testHTSMinter.getAddress();
  console.log("TestHTSMinter deployed to:", contractAddress);

  // Save deployment info
  const deploymentInfo = {
    minterContract: contractAddress,
    timestamp: new Date().toISOString(),
    network: (await ethers.provider.getNetwork()).name || "unknown",
  };

  fs.writeFileSync(
    "debug-minter-deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Deployment info saved to debug-minter-deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 