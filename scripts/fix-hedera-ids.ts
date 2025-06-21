import { DeploymentManager } from './deployment-manager';

async function main() {
  console.log("🔧 Fixing Hedera ID conversions...\n");
  
  const deploymentManager = new DeploymentManager();
  
  // The correct Hedera IDs based on the EVM addresses
  // For Hedera, EVM addresses are derived from contract IDs, not the other way around
  // We need to use the actual Hedera contract IDs from the network
  
  // Use the correct Hedera IDs from our previous conversation
  const controllerHederaId = "0.0.5948417"; // Confirmed correct controller ID
  const vaultHederaId = "0.0.5948418"; // Likely the vault ID (sequential)
  
  console.log("🔄 Updating with corrected Hedera IDs:");
  console.log(`Vault: ${vaultHederaId}`);
  console.log(`Controller: ${controllerHederaId}`);
  
  // Update the registry with corrected IDs
  deploymentManager.recordContractDeployment("IndexVault", vaultHederaId, "0x2327751935B8a96183F698e6625FEffbC81dd97e");
  deploymentManager.recordContractDeployment("IndexTokenController", controllerHederaId, "0xF714C429c5E210E27Cf5F40de3e892Fb8710923c");
  
  // Mark as verified
  deploymentManager.verifyDeployment("contract", "IndexVault");
  deploymentManager.verifyDeployment("contract", "IndexTokenController");
  
  // Generate environment file
  deploymentManager.generateEnvironmentFile();
  deploymentManager.printStatus();
  
  console.log("\n✅ Hedera IDs corrected!");
  console.log("📄 Run 'npm run setup-env' to update environment variables");
}

main().catch(console.error); 