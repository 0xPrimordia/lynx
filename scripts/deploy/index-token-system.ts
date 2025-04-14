import "@nomicfoundation/hardhat-ethers";
import { ethers } from "hardhat";
import fs from 'fs';
import path from 'path';
import { ContractId } from "@hashgraph/sdk";

/**
 * Index Token System Deployment Script
 * 
 * This script deploys the Lynx Index Token system with public minting capability.
 * The deployed contracts allow any user with sufficient deposits to mint tokens
 * without requiring admin privileges.
 */

const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";

// Helper function to convert EVM address to Hedera ID format
function evmAddressToHederaId(evmAddress: string): string {
  if (evmAddress.length !== 42) {
    throw new Error(`Invalid EVM address: ${evmAddress}`);
  }
  
  try {
    // Use the Hedera SDK's ContractId to convert properly
    const contractId = ContractId.fromSolidityAddress(evmAddress);
    return contractId.toString();
  } catch (error) {
    // Fallback to direct conversion if SDK method fails
    const hex = evmAddress.replace("0x", "");
    const num = BigInt(`0x${hex}`);
    return `0.0.${num.toString()}`;
  }
}

// Helper function to save deployment info
function saveDeploymentInfo(info: any): void {
  const deploymentInfoPath = path.join(__dirname, '../../../deployment-info.json');
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(info, null, 2));
}

async function main() {
  try {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    
    // Deploy IndexVault first
    console.log("\n1. Deploying IndexVault...");
    const IndexVault = await ethers.getContractFactory("IndexVault");
    // Pass the controller as empty address first, we'll update it later
    // IndexVault constructor takes (address _controller, address _htsAddress)
    const vault = await IndexVault.deploy(
      deployer.address, // temporary controller address
      HTS_PRECOMPILE, // HTS precompile address
      {
        gasLimit: 500000,
        gasPrice: ethers.parseUnits("600", "gwei")
      }
    );
    
    console.log("Waiting for vault deployment...");
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`IndexVault deployed to: ${vaultAddress}`);
    
    // Deploy IndexTokenController with reference to vault
    console.log("\n2. Deploying IndexTokenController with public minting support...");
    const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
    // IndexTokenController constructor takes (address _vaultAddress, address _htsAddress)
    const controller = await IndexTokenController.deploy(
      vaultAddress,
      HTS_PRECOMPILE, // HTS precompile address
      {
        gasLimit: 500000,
        gasPrice: ethers.parseUnits("600", "gwei")
      }
    );
    
    console.log("Waiting for controller deployment...");
    await controller.waitForDeployment();
    const controllerAddress = await controller.getAddress();
    console.log(`IndexTokenController deployed to: ${controllerAddress}`);
    console.log("NOTE: This controller allows public minting - any user with sufficient deposits can mint tokens");
    
    // Update controller in vault
    console.log("\n3. Setting controller in vault...");
    const updateTx = await vault.updateController(controllerAddress, {
      gasLimit: 100000,
      gasPrice: ethers.parseUnits("600", "gwei")
    });
    await updateTx.wait();
    console.log("Controller set in vault successfully");
    
    // Get contract addresses in Hedera ID format
    const vaultId = evmAddressToHederaId(vaultAddress);
    const controllerId = evmAddressToHederaId(controllerAddress);
    
    console.log("\nDeployment summary:");
    console.log(`VaultId: ${vaultId}`);
    console.log(`ControllerId: ${controllerId}`);
    
    // Save deployment info
    const deploymentInfo = {
      vaultId,
      controllerId,
      tokenAddress: "0000000000000000000000000000000000000000"
    };
    
    saveDeploymentInfo(deploymentInfo);
    console.log("\nDeployment info saved to deployment-info.json");
    
    // Output instructions for next steps
    console.log("\nNext steps:");
    console.log("1. Fund the controller contract:  npx hardhat run scripts/token/fund.ts --network hederaTestnet");
    console.log("2. Create the token:              npx hardhat run scripts/token/create.ts --network hederaTestnet");
    console.log("3. Set up vault composition:      node scripts/setup-vault-composition.js");
    console.log("4. Verify token creation:         npx hardhat run scripts/token/verify.ts --network hederaTestnet");
    console.log("5. Start minting tokens:          node scripts/mint-token.js");
    
  } catch (error: any) {
    console.error("Error in deployment:", error.message || error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: any) => {
    console.error(error);
    process.exit(1);
  }); 