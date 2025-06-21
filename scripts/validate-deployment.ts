import { DeploymentManager } from "./deployment-manager";

async function main() {
  console.log("🔍 Validating current deployment status...\n");
  
  const deploymentManager = new DeploymentManager();
  
  // Check current status
  deploymentManager.printStatus();
  
  // Validate environment
  const isValid = deploymentManager.validateEnvironment();
  
  if (!isValid) {
    console.log("\n💡 Recommendations:");
    console.log("1. Run: npm run deploy-fresh");
    console.log("2. Update .env.local with values from .env.deployment");
    console.log("3. Test minting functionality");
  }
}

main().catch(console.error); 