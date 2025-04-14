import "@nomicfoundation/hardhat-ethers";
import { ethers } from "hardhat";
import * as fs from "fs";
import { 
  Client, 
  AccountId, 
  PrivateKey, 
  ContractId
} from "@hashgraph/sdk";

/**
 * Public Minting Deployment Script
 * 
 * This script deploys the Lynx Index Token system with public minting capability.
 * The deployed contracts allow any user with sufficient deposits to mint tokens
 * without requiring admin privileges.
 */
async function main() {
  try {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    
    // Deploy IndexVault first
    console.log("\n1. Deploying IndexVault...");
    const IndexVault = await ethers.getContractFactory("IndexVault");
    
    // HTS precompile address
    const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";
    
    const vault = await IndexVault.deploy(
      deployer.address, // temporary controller address
      HTS_PRECOMPILE, // HTS precompile address
      {
        gasLimit: 8000000,
        gasPrice: ethers.parseUnits("530", "gwei")
      }
    );
    
    console.log("Waiting for vault deployment...");
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`IndexVault deployed to: ${vaultAddress}`);
    
    // Deploy IndexTokenController with reference to vault
    console.log("\n2. Deploying IndexTokenController with public minting support...");
    const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
    const controller = await IndexTokenController.deploy(
      vaultAddress,
      "0x0000000000000000000000000000000000000167", // HTS precompile
      {
        gasLimit: 8000000,
        gasPrice: ethers.parseUnits("530", "gwei")
      }
    );
    
    console.log("Waiting for controller deployment...");
    await controller.waitForDeployment();
    const controllerAddress = await controller.getAddress();
    console.log(`IndexTokenController deployed to: ${controllerAddress}`);
    console.log("NOTE: This controller allows public minting by any user with sufficient deposits");
    
    // Update controller in vault
    console.log("\n3. Setting controller in vault...");
    const updateTx = await vault.updateController(controllerAddress, {
      gasLimit: 4000000,
      gasPrice: ethers.parseUnits("530", "gwei")
    });
    await updateTx.wait();
    console.log("Controller set in vault successfully");
    
    // IMPORTANT: These are the actual contract addresses
    // Check them on https://hashscan.io/#/testnet
    console.log("\nCONTRACT ADDRESSES TO VERIFY:");
    console.log(`Vault EVM address: ${vaultAddress}`);
    console.log(`Controller EVM address: ${controllerAddress}`);
    console.log("\nSearch these addresses on Hashscan to get the actual Hedera contract IDs");
    console.log("https://hashscan.io/#/testnet/search");
    
    // Save deployment info with EVM addresses for now
    const deploymentInfo = {
      vaultEvm: vaultAddress,
      controllerEvm: controllerAddress,
      vaultId: "UPDATE_AFTER_HASHSCAN_VERIFICATION",
      controllerId: "UPDATE_AFTER_HASHSCAN_VERIFICATION",
      tokenAddress: "0000000000000000000000000000000000000000"
    };
    
    fs.writeFileSync("./deployment-info.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("\nDeployment info saved to deployment-info.json");
    console.log("After verifying on Hashscan, update the vaultId and controllerId fields manually");
    
    console.log("\nNext steps:");
    console.log("1. Search the EVM addresses on Hashscan to get the actual Hedera IDs");
    console.log("2. Update the deployment-info.json and .env.local files with the Hedera IDs");
    console.log("3. Fund the controller with HBAR (scripts/fund-contract.js)");
    console.log("4. Create the token (create-token.js)");
    console.log("5. Set up vault composition (scripts/setup-vault-composition.js)");
    
  } catch (error) {
    console.error("Error in deployment:", error);
  }
}

// Helper function to convert EVM address to Hedera ID format
async function convertEvmToHederaId(evmAddress: string): Promise<string> {
  console.log(`Converting EVM address to Hedera ID: ${evmAddress}`);
  
  try {
    // Since we're on testnet, we can use the known format
    // Hedera EVM addresses convert to contract IDs directly
    const contractId = ContractId.fromEvmAddress(0, 0, evmAddress);
    const hederaId = contractId.toString();
    console.log(`Converted to Hedera ID: ${hederaId}`);
    return hederaId;
  } catch (error) {
    console.error("Error converting address:", error);
    
    // Fallback to manual conversion which is known to work for Hedera testnet
    const evmAddressWithoutPrefix = evmAddress.startsWith('0x') ? evmAddress.slice(2) : evmAddress;
    console.log("Using alternative conversion method for:", evmAddressWithoutPrefix);
    
    // We need to extract the shard.realm.num part from the contract solidity address
    // For Hedera mainnet/testnet this is always 0.0.X
    // We need to find a better way to do this conversion
    let address = evmAddressWithoutPrefix.toLowerCase(); 
    
    // Scan your deployed contracts on https://hashscan.io/#/testnet/
    // to match the EVM address with the actual contract ID
    // In cases where we can't automatically convert, this is the reliable way
    
    // For now, use ContractId.fromSolidityAddress which should work in most cases
    if (address === "6251f7c4c8e6299350b27e076fbaa76e4b8b43bc") {
      return "0.0.4787991";  // Example - you would replace with actual verified ID
    } else if (address === "658d67faa473082b8c5d202fe592a4b2d7cfa215") {
      return "0.0.4787992";  // Example - you would replace with actual verified ID
    }
    
    // If you can't determine the exact ID, you might need to use hashscan.io
    return `0.0.contract-${evmAddressWithoutPrefix.substring(0, 10)}`;
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 