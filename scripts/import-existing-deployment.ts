import fs from 'fs';
import { DeploymentManager } from './deployment-manager';

async function main() {
  console.log("📥 Importing existing deployment...\n");
  
  // Read existing deployment info
  const existingDeployment = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  console.log("Found existing deployment:", existingDeployment);
  
  const deploymentManager = new DeploymentManager();
  
  // Convert EVM addresses to Hedera IDs
  const vaultHederaId = convertEvmToHederaId(existingDeployment.vaultEvm);
  const controllerHederaId = convertEvmToHederaId(existingDeployment.controllerEvm);
  
  console.log(`\n🔄 Converting addresses:`);
  console.log(`Vault: ${existingDeployment.vaultEvm} → ${vaultHederaId}`);
  console.log(`Controller: ${existingDeployment.controllerEvm} → ${controllerHederaId}`);
  
  // Record in our registry
  deploymentManager.recordContractDeployment("IndexVault", vaultHederaId, existingDeployment.vaultEvm);
  deploymentManager.recordContractDeployment("IndexTokenController", controllerHederaId, existingDeployment.controllerEvm);
  
  // Mark as verified since they're already deployed
  deploymentManager.verifyDeployment("contract", "IndexVault");
  deploymentManager.verifyDeployment("contract", "IndexTokenController");
  
  // Generate environment file
  deploymentManager.generateEnvironmentFile();
  
  // Show status
  deploymentManager.printStatus();
  
  console.log("\n✅ Existing deployment imported successfully!");
  console.log("📄 Run 'npm run setup-env' to update your environment variables");
}

function convertEvmToHederaId(evmAddress: string): string {
  try {
    const hex = evmAddress.replace("0x", "");
    const num = BigInt(`0x${hex}`);
    return `0.0.${num.toString()}`;
  } catch (error) {
    console.warn(`Could not convert ${evmAddress}:`, error);
    return `MANUAL_CONVERSION_NEEDED_${evmAddress}`;
  }
}

main().catch(console.error); 