import "@nomicfoundation/hardhat-ethers";
import { ethers } from "hardhat";
import { DeploymentManager } from "./deployment-manager";

async function main() {
  const deploymentManager = new DeploymentManager();
  
  console.log("🚀 Starting fresh deployment with tracking...\n");
  
  try {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} HBAR`);

    // Step 1: Deploy IndexVault with deployer as temporary controller  
    console.log("📦 Deploying IndexVault...");
    const IndexVault = await ethers.getContractFactory("IndexVault");
    console.log("Factory created, deploying with parameters:", deployer.address);
    
    const vault = await IndexVault.deploy(deployer.address, {
      gasLimit: 2000000,
      gasPrice: ethers.parseUnits("800", "gwei"),
      value: 0
    });
    await vault.waitForDeployment();
    
    const vaultAddress = await vault.getAddress();
    console.log(`✅ IndexVault deployed to: ${vaultAddress}`);
    
    // Step 2: Deploy IndexTokenController with vault address
    console.log("📦 Deploying IndexTokenController...");
    const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
    const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167";
    const controller = await IndexTokenController.deploy(vaultAddress, HTS_PRECOMPILE, {
      gasLimit: 2000000,
      gasPrice: ethers.parseUnits("800", "gwei"),
      value: 0
    });
    await controller.waitForDeployment();
    
    const controllerAddress = await controller.getAddress();
    console.log(`✅ IndexTokenController deployed to: ${controllerAddress}`);
    
    // Step 3: Update vault controller
    console.log("🔗 Setting controller in vault...");
    const setControllerTx = await vault.updateController(controllerAddress, {
      gasLimit: 500000,
      gasPrice: ethers.parseUnits("800", "gwei")
    });
    await setControllerTx.wait();
    console.log("✅ Controller updated in vault");
    
    // Get actual Hedera IDs from deployment receipts
    console.log("🔍 Extracting Hedera contract IDs from deployment receipts...");
    
    const vaultReceipt = await vault.deploymentTransaction()?.wait();
    const controllerReceipt = await controller.deploymentTransaction()?.wait();
    
    // Extract contract IDs from logs or use conversion
    const vaultHederaId = extractHederaIdFromReceipt(vaultReceipt) || convertEvmToHederaId(vaultAddress);
    const controllerHederaId = extractHederaIdFromReceipt(controllerReceipt) || convertEvmToHederaId(controllerAddress);
    
    console.log(`📝 Vault Contract ID: ${vaultHederaId}`);
    console.log(`📝 Controller Contract ID: ${controllerHederaId}`);
    
    deploymentManager.recordContractDeployment("IndexVault", vaultHederaId, vaultAddress);
    deploymentManager.recordContractDeployment("IndexTokenController", controllerHederaId, controllerAddress);
    
    // Step 3: Create LYNX token through controller
    console.log("🪙 Creating LYNX token...");
    const createTx = await controller.createIndexToken(
      "Lynx Index Token",
      "LYNX", 
      "Index token representing a basket of assets",
      { 
        value: ethers.parseEther("20"),
        gasLimit: 1000000,
        gasPrice: ethers.parseUnits("800", "gwei")
      }
    );
    
    const receipt = await createTx.wait();
    console.log("✅ Token creation transaction confirmed");
    
    // Extract token ID from events
    const tokenCreatedEvent = receipt?.logs.find((log: any) => 
      log.topics[0] === ethers.id("IndexTokenCreated(address,int64)")
    );
    
    if (tokenCreatedEvent) {
      const tokenAddress = ethers.AbiCoder.defaultAbiCoder().decode(
        ["address", "int64"],
        tokenCreatedEvent.data
      )[0];
      
      const tokenHederaId = convertEvmToHederaId(tokenAddress);
      deploymentManager.recordTokenCreation("LYNX", tokenHederaId, controllerHederaId);
      console.log(`🪙 LYNX token created: ${tokenHederaId}`);
    }
    
    // Step 4: Verify all deployments
    console.log("\n🔍 Verifying deployments...");
    
    // Verify contracts exist and are functional
    const vaultCode = await ethers.provider.getCode(vaultAddress);
    const controllerCode = await ethers.provider.getCode(controllerAddress);
    
    if (vaultCode !== "0x") {
      deploymentManager.verifyDeployment("contract", "IndexVault");
    }
    
    if (controllerCode !== "0x") {
      deploymentManager.verifyDeployment("contract", "IndexTokenController");
    }
    
    // Verify token was created successfully
    const tokenAddress = await controller.getTokenAddress();
    if (tokenAddress !== ethers.ZeroAddress) {
      deploymentManager.verifyDeployment("token", "LYNX");
    }
    
    // Step 5: Generate environment file
    deploymentManager.generateEnvironmentFile();
    
    // Step 6: Final validation
    deploymentManager.validateEnvironment();
    deploymentManager.printStatus();
    
    console.log("\n🎉 Deployment completed successfully!");
    console.log("📄 Check .env.deployment for environment variables");
    console.log("📊 Check deployment-registry.json for full deployment details");
    
  } catch (error) {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  }
}

// Helper function to extract Hedera ID from deployment receipt
function extractHederaIdFromReceipt(receipt: any): string | null {
  // Look for ContractResult event or similar in logs
  // For now, return null to fall back to conversion
  return null;
}

// Helper function to convert EVM address to Hedera ID
function convertEvmToHederaId(evmAddress: string): string {
  try {
    // Remove 0x prefix and convert to BigInt
    const hex = evmAddress.replace("0x", "");
    const num = BigInt(`0x${hex}`);
    return `0.0.${num.toString()}`;
  } catch (error) {
    console.warn(`Could not convert ${evmAddress} to Hedera ID:`, error);
    return `CONVERT_MANUALLY_${evmAddress}`;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 