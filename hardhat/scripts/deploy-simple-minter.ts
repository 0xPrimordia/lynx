import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as hre from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("Deploying SimpleTokenMinter contract...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatUnits(balance, 18), "HBAR");

  // Deploy contract
  const SimpleTokenMinter = await hre.ethers.getContractFactory("SimpleTokenMinter");
  const minter = await SimpleTokenMinter.deploy({
    gasLimit: 1000000,
    gasPrice: hre.ethers.parseUnits("530", "gwei"), // 530 gwei minimum for Hedera
  });

  await minter.waitForDeployment();
  const contractAddress = await minter.getAddress();
  console.log("SimpleTokenMinter deployed to:", contractAddress);

  // Save deployment info
  const deploymentInfo = {
    minterAddress: contractAddress,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    "simple-minter-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Deployment info saved to simple-minter-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 