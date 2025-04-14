import "@nomicfoundation/hardhat-ethers";
import { ethers } from "hardhat";
import fs from 'fs';
import path from 'path';
import { 
  Client, 
  AccountId, 
  PrivateKey, 
  ContractId
} from "@hashgraph/sdk";

/**
 * Index Token System Deployment Script
 * 
 * This script deploys the Lynx Index Token system with public minting capability.
 * The deployed contracts allow any user with sufficient deposits to mint tokens
 * without requiring admin privileges.
 */

const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";

/**
 * Convert an EVM address to a Hedera ID using the Hedera SDK
 */
async function evmAddressToHederaId(evmAddress: string): Promise<string> {
  console.log(`Converting EVM address to Hedera ID: ${evmAddress}`);
  
  // Validate environment
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  if (!operatorId || !operatorKey) {
    throw new Error("Missing required environment variables");
  }
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  // Use the SDK's ContractId to get the proper Hedera ID
  const contractId = ContractId.fromSolidityAddress(evmAddress);
  const hederaId = contractId.toString();
  console.log(`Converted to Hedera ID: ${hederaId}`);
  return hederaId;
}

// Helper function to save deployment info
function saveDeploymentInfo(info: any): void {
  const deploymentInfoPath = path.join(__dirname, '../../../deployment-info.json');
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(info, null, 2));
}

// Helper function to update .env.local with deployment info
function updateEnvFile(vaultId: string, controllerId: string): void {
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
  
  // Variables to update/add
  const varsToUpdate = {
    'NEXT_PUBLIC_VAULT_ID': vaultId,
    'NEXT_PUBLIC_LYNX_CONTRACT_ID': controllerId,
  };
  
  // Track which variables we've already updated
  const updatedKeys = new Set<string>();
  
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
      if (varsToUpdate[key as keyof typeof varsToUpdate]) {
        updatedVars.push(`${key}=${varsToUpdate[key as keyof typeof varsToUpdate]}`);
        updatedKeys.add(key);
      } else {
        updatedVars.push(line); // Keep unchanged line
      }
    } else {
      updatedVars.push(line); // Keep line without equals
    }
  }
  
  // Add any variables that weren't in the original file
  for (const [key, value] of Object.entries(varsToUpdate)) {
    if (!updatedKeys.has(key)) {
      updatedVars.push(`${key}=${value}`);
    }
  }
  
  // Write updated content back to file
  fs.writeFileSync(envFilePath, updatedVars.join('\n'));
  console.log("Updated .env.local file with deployment information.");
}

async function main() {
  try {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "HBAR");
    
    // Check if we're deploying to local or testnet
    const network = await ethers.provider.getNetwork();
    const isLocal = network.chainId === 1337n || network.chainId === 31337n;
    
    // Gas limits are higher for local testing but lower than original values for testnet
    const vaultGasLimit = isLocal ? 2000000 : 400000;
    const controllerGasLimit = isLocal ? 2000000 : 400000;
    const updateGasLimit = isLocal ? 200000 : 80000;
    
    console.log(`Using gas limits for ${isLocal ? 'local network' : 'Hedera testnet'}`);
    console.log(`- Vault deployment: ${vaultGasLimit}`);
    console.log(`- Controller deployment: ${controllerGasLimit}`);
    console.log(`- Update controller: ${updateGasLimit}`);
    
    // Deploy IndexVault first
    console.log("\n1. Deploying IndexVault...");
    const IndexVault = await ethers.getContractFactory("IndexVault");
    // Pass the controller as empty address first, we'll update it later
    // IndexVault constructor takes (address _controller, address _htsAddress)
    const vault = await IndexVault.deploy(
      deployer.address, // temporary controller address
      HTS_PRECOMPILE, // HTS precompile address
      {
        gasLimit: vaultGasLimit,
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
    // IndexTokenController constructor takes (address _vaultAddress, address _htsAddress)
    const controller = await IndexTokenController.deploy(
      vaultAddress,
      HTS_PRECOMPILE, // HTS precompile address
      {
        gasLimit: controllerGasLimit,
        gasPrice: ethers.parseUnits("530", "gwei")
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
      gasLimit: updateGasLimit,
      gasPrice: ethers.parseUnits("530", "gwei")
    });
    await updateTx.wait();
    console.log("Controller set in vault successfully");
    
    // Display EVM addresses
    console.log("\nCONTRACT ADDRESSES (USE THESE):");
    console.log(`Vault EVM address: ${vaultAddress}`);
    console.log(`Controller EVM address: ${controllerAddress}`);
    
    // Convert to Hedera IDs using the SDK
    console.log("\nAttempting conversions to Hedera IDs (for reference only):");
    const vaultId = await evmAddressToHederaId(vaultAddress);
    const controllerId = await evmAddressToHederaId(controllerAddress);
    
    console.log("\nCOMPARISON (USE EVM ADDRESSES FOR NOW):");
    console.log(`Vault EVM: ${vaultAddress} -> Converted: ${vaultId}`);
    console.log(`Controller EVM: ${controllerAddress} -> Converted: ${controllerId}`);
    console.log("\nIMPORTANT: Use the EVM addresses in Hashscan to find the correct Hedera IDs manually");
    
    // Save deployment info
    const deploymentInfo = {
      vaultId,
      controllerId,
      vaultEvm: vaultAddress,
      controllerEvm: controllerAddress,
      tokenAddress: "0000000000000000000000000000000000000000"
    };
    
    saveDeploymentInfo(deploymentInfo);
    console.log("\nDeployment info saved to deployment-info.json");
    
    // Update .env.local
    try {
      updateEnvFile(vaultAddress, controllerAddress);
      console.log("Deployment information added to .env.local file");
    } catch (error) {
      console.warn("Could not update .env.local file:", error);
      console.log("Please manually update your .env.local file with:");
      console.log(`NEXT_PUBLIC_VAULT_ID=${vaultAddress}`);
      console.log(`NEXT_PUBLIC_LYNX_CONTRACT_ID=${controllerAddress}`);
    }
    
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