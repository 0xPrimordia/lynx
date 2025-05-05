import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  console.log("Deploying TestHTSMinimal contract...");

  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HBAR");

  // Deploy the TestHTSMinimal contract
  const TestHTSMinimal = await ethers.getContractFactory("TestHTSMinimal");
  const testHTSMinimal = await TestHTSMinimal.deploy({
    gasLimit: 1000000,
    gasPrice: ethers.parseUnits("530", "gwei"), // 530 gwei minimum for Hedera
  });

  await testHTSMinimal.waitForDeployment();
  const contractAddress = await testHTSMinimal.getAddress();
  console.log("TestHTSMinimal deployed to:", contractAddress);

  // Save deployment info
  const deploymentInfo = {
    minimaltestContract: contractAddress,
    timestamp: new Date().toISOString(),
    network: (await ethers.provider.getNetwork()).name || "unknown",
  };

  fs.writeFileSync(
    "debug-minimal-deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Deployment info saved to debug-minimal-deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 