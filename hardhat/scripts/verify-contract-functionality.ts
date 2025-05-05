import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("VERIFYING CONTRACT FUNCTIONALITY");
  console.log("================================");
  
  // Load deployment info
  let vaultAddress = "";
  let controllerAddress = "";
  try {
    const deploymentInfo = JSON.parse(fs.readFileSync("../deployment-info.json", "utf8"));
    vaultAddress = deploymentInfo.vaultEvm;
    controllerAddress = deploymentInfo.controllerEvm;
    console.log(`Loaded addresses from deployment info:`);
    console.log(`- Vault: ${vaultAddress}`);
    console.log(`- Controller: ${controllerAddress}`);
  } catch (error) {
    console.error("Error loading deployment info:", error);
    process.exit(1);
  }
  
  try {
    // Connect to contracts
    console.log("\nStep 1: Connecting to contracts...");
    
    const [deployer] = await ethers.getSigners();
    console.log(`Using account: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} HBAR`);
    
    // Get contract factories
    const IndexVault = await ethers.getContractFactory("IndexVault");
    const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
    
    // Connect to deployed contracts
    console.log("\nConnecting to vault...");
    const vault = await IndexVault.attach(vaultAddress);
    
    console.log("Connecting to controller...");
    const controller = await IndexTokenController.attach(controllerAddress);
    
    // Test simple read functions
    console.log("\nStep 2: Testing basic read functions...");
    
    console.log("\nVault contract:");
    try {
      const admin = await vault.admin();
      console.log(`- Admin: ${admin}`);
      
      const vaultController = await vault.controller();
      console.log(`- Controller: ${vaultController}`);
      
      const indexToken = await vault.indexToken();
      console.log(`- Index token: ${indexToken}`);
      
      const govActivated = await vault.governanceActivated();
      console.log(`- Governance activated: ${govActivated}`);
      
      const totalWeight = await vault.totalWeight();
      console.log(`- Total weight: ${totalWeight.toString()}`);
      
      console.log("Vault read functions working correctly ✅");
    } catch (error) {
      console.error("Error reading from vault:", error);
      console.log("Vault read functions failed ❌");
    }
    
    console.log("\nController contract:");
    try {
      const htsPrecompile = await controller.HTS_PRECOMPILE();
      console.log(`- HTS precompile: ${htsPrecompile}`);
      
      const admin = await controller.ADMIN();
      console.log(`- Admin: ${admin}`);
      
      const indexToken = await controller.INDEX_TOKEN();
      console.log(`- Index token: ${indexToken}`);
      
      const hasSupplyKey = await controller.hasSupplyKey();
      console.log(`- Has supply key: ${hasSupplyKey}`);
      
      console.log("Controller read functions working correctly ✅");
    } catch (error) {
      console.error("Error reading from controller:", error);
      console.log("Controller read functions failed ❌");
    }
    
    // Test simple write functions
    console.log("\nStep 3: Testing basic write function (admin-only)...");
    
    try {
      // Check if we're the admin of the vault
      const admin = await vault.admin();
      if (admin.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("Account is the admin of the vault. Testing adding a dummy token...");
        
        // Try adding a fake token (won't actually be used)
        const dummyTokenAddress = "0x0000000000000000000000000000000000000001";
        const dummyWeight = 10;
        
        console.log(`Adding dummy token ${dummyTokenAddress} with weight ${dummyWeight}...`);
        const tx = await vault.addToken(dummyTokenAddress, dummyWeight, {
          gasLimit: 400000,
          gasPrice: ethers.parseUnits("600", "gwei")
        });
        
        console.log("Transaction sent, waiting for confirmation...");
        await tx.wait();
        console.log("Token added successfully ✅");
        
        // Verify it was added
        console.log("Checking if token was added...");
        const isToken = await vault.isCompositionToken(dummyTokenAddress);
        console.log(`Token is in composition: ${isToken}`);
        
        if (isToken) {
          const tokenWeight = await vault.tokenWeights(dummyTokenAddress);
          console.log(`Token weight: ${tokenWeight.toString()}`);
        }
      } else {
        console.log(`Account ${deployer.address} is not the admin (${admin}). Skipping write test.`);
      }
    } catch (error) {
      console.error("Error testing write function:", error);
      console.log("Write function test failed ❌");
    }
    
    console.log("\nCONTRACT VERIFICATION COMPLETE");
    
  } catch (error) {
    console.error("Error during verification:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  }); 