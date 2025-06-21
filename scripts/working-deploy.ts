import "@nomicfoundation/hardhat-ethers";
import { ethers } from "hardhat";
import { DeploymentManager } from "./deployment-manager";

async function main() {
  const deploymentManager = new DeploymentManager();
  
  console.log("🚀 Working deployment with proper dependency handling...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} HBAR`);

  try {
    const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";
    
    // Step 1: Deploy a temporary/placeholder vault to get an address for the controller
    console.log("📦 Step 1: Deploying placeholder vault...");
    const IndexVault = await ethers.getContractFactory("IndexVault");
    
    // Deploy vault with deployer as temporary controller
    const tempVault = await IndexVault.deploy(deployer.address, {
      gasLimit: 500000,
      gasPrice: ethers.parseUnits("600", "gwei")
    });
    await tempVault.waitForDeployment();
    
    const tempVaultAddress = await tempVault.getAddress();
    console.log(`✅ Temporary vault deployed to: ${tempVaultAddress}`);
    
    // Step 2: Deploy the real controller with the temporary vault address
    console.log("📦 Step 2: Deploying controller...");
    const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
    
    const controller = await IndexTokenController.deploy(tempVaultAddress, HTS_PRECOMPILE, {
      gasLimit: 500000,
      gasPrice: ethers.parseUnits("600", "gwei")
    });
    await controller.waitForDeployment();
    
    const controllerAddress = await controller.getAddress();
    console.log(`✅ Controller deployed to: ${controllerAddress}`);
    
    // Step 3: Deploy the real vault with the controller address
    console.log("📦 Step 3: Deploying real vault...");
    const realVault = await IndexVault.deploy(controllerAddress, {
      gasLimit: 500000,
      gasPrice: ethers.parseUnits("600", "gwei")
    });
    await realVault.waitForDeployment();
    
    const realVaultAddress = await realVault.getAddress();
    console.log(`✅ Real vault deployed to: ${realVaultAddress}`);
    
    // Step 4: Deploy a new controller with the real vault address
    console.log("📦 Step 4: Deploying final controller...");
    const finalController = await IndexTokenController.deploy(realVaultAddress, HTS_PRECOMPILE, {
      gasLimit: 500000,
      gasPrice: ethers.parseUnits("600", "gwei")
    });
    await finalController.waitForDeployment();
    
    const finalControllerAddress = await finalController.getAddress();
    console.log(`✅ Final controller deployed to: ${finalControllerAddress}`);
    
    // Record the final deployments in our registry
    const vaultHederaId = await convertToHederaId(realVaultAddress);
    const controllerHederaId = await convertToHederaId(finalControllerAddress);
    
    deploymentManager.recordContractDeployment("IndexVault", vaultHederaId, realVaultAddress);
    deploymentManager.recordContractDeployment("IndexTokenController", controllerHederaId, finalControllerAddress);
    
    // Verify deployments work
    console.log("\n🔍 Verifying deployments...");
    const vaultCode = await ethers.provider.getCode(realVaultAddress);
    const controllerCode = await ethers.provider.getCode(finalControllerAddress);
    
    if (vaultCode !== "0x") {
      deploymentManager.verifyDeployment("contract", "IndexVault");
      console.log("✅ Vault deployment verified");
    }
    
    if (controllerCode !== "0x") {
      deploymentManager.verifyDeployment("contract", "IndexTokenController");
      console.log("✅ Controller deployment verified");
    }
    
    // Generate environment file
    deploymentManager.generateEnvironmentFile();
    deploymentManager.printStatus();
    
    console.log("\n🎉 Deployment completed successfully!");
    console.log(`📄 Vault: ${realVaultAddress} (${vaultHederaId})`);
    console.log(`📄 Controller: ${finalControllerAddress} (${controllerHederaId})`);
    console.log("\n📋 Next steps:");
    console.log("1. Run: npm run setup-env");
    console.log("2. Update .env.local with new values");
    console.log("3. Test token creation through the controller");
    
  } catch (error) {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  }
}

async function convertToHederaId(evmAddress: string): Promise<string> {
  try {
    const hex = evmAddress.replace("0x", "");
    const num = BigInt(`0x${hex}`);
    return `0.0.${num.toString()}`;
  } catch (error) {
    console.warn(`Could not convert ${evmAddress} to Hedera ID:`, error);
    return `CONVERT_MANUALLY_${evmAddress}`;
  }
}

main().catch(console.error); 