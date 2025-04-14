import '@nomicfoundation/hardhat-ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Contract } from 'ethers';
import * as hre from 'hardhat';
import config from "../../deploy-config";
import { saveDeploymentInfo } from "../utils/deployment";
import { ethers } from "hardhat";
import { TokenConfig, DeploymentInfo } from "../types";

const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Index Token System with account:", deployer.address);

  // Deploy IndexVault
  console.log("Deploying IndexVault...");
  const IndexVault = await ethers.getContractFactory("IndexVault");
  const vault = await IndexVault.deploy(deployer.address, HTS_PRECOMPILE);
  await vault.deployed();
  console.log("IndexVault deployed to:", vault.address);

  // Deploy IndexTokenController
  console.log("Deploying IndexTokenController...");
  const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
  const controller = await IndexTokenController.deploy(vault.address);
  await controller.deployed();
  console.log("IndexTokenController deployed to:", controller.address);

  // Update controller address in vault
  console.log("Updating controller address in vault...");
  await vault.setController(controller.address);
  console.log("Controller address updated in vault");

  // Create index token
  console.log("Creating index token...");
  const tokenConfig: TokenConfig = {
    name: "Lynx Index Token",
    symbol: "LYNX",
    memo: "Lynx Index Token"
  };
  await controller.createIndexToken(tokenConfig.name, tokenConfig.symbol, tokenConfig.memo);
  console.log("Index token created");

  // Save deployment info
  const network = await ethers.provider.getNetwork();
  const indexVaultAddress = await vault.getAddress();
  const indexTokenControllerAddress = await controller.getAddress();

  const deploymentInfo: DeploymentInfo = {
    network: network.name,
    timestamp: new Date().toISOString(),
    contracts: {
      IndexVault: {
        address: indexVaultAddress,
        deployer: deployer.address,
        constructorArgs: []
      },
      IndexTokenController: {
        address: indexTokenControllerAddress,
        deployer: deployer.address,
        constructorArgs: [indexVaultAddress]
      }
    }
  };
  await saveDeploymentInfo(deploymentInfo);
  console.log("Deployment info saved");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 