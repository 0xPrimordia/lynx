import { ethers } from "hardhat";
import * as fs from "fs";

// Governance agent EVM address (hardcoded as specified)
const AGENT_EVM_ADDRESS = "0x00000000000000000000000000000000005d3c19";

async function main() {
  console.log("TRANSFERRING VAULT ADMIN TO AGENT");
  console.log("==================================");
  
  console.log(`Agent EVM address: ${AGENT_EVM_ADDRESS}`);
  
  // Load deployment info
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync("hardhat/deployment-info.json", "utf8"));
    console.log("\nLoaded deployment info:");
    console.log(`- Vault: ${deploymentInfo.vaultEvm}`);
    console.log(`- Controller: ${deploymentInfo.controllerEvm}`);
  } catch (error) {
    console.error("Error loading deployment info:", error);
    console.error("Make sure deployment-info.json exists in hardhat directory");
    process.exit(1);
  }
  
  // Connect to contracts
  const [deployer] = await ethers.getSigners();
  console.log(`\nUsing account: ${deployer.address}`);
  
  const IndexVault = await ethers.getContractFactory("IndexVault");
  const vault = await IndexVault.attach(deploymentInfo.vaultEvm);
  
  try {
    // Check current admin
    const currentAdmin = await vault.admin();
    console.log(`\nCurrent vault admin: ${currentAdmin}`);
    
    if (currentAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error(`❌ Account ${deployer.address} is not the admin of the vault (current admin: ${currentAdmin})`);
      process.exit(1);
    }
    
    if (currentAdmin.toLowerCase() === AGENT_EVM_ADDRESS.toLowerCase()) {
      console.log("✅ Agent is already the admin. No transfer needed.");
      return;
    }
    
    // Validate agent address
    if (!ethers.isAddress(AGENT_EVM_ADDRESS)) {
      console.error(`❌ Invalid agent EVM address: ${AGENT_EVM_ADDRESS}`);
      process.exit(1);
    }
    
    console.log(`\n🔄 Transferring admin from ${currentAdmin} to ${AGENT_EVM_ADDRESS}...`);
    
    // Transfer admin
    console.log("Sending updateAdmin transaction...");
    const tx = await vault.updateAdmin(AGENT_EVM_ADDRESS, {
      gasLimit: 150000,
      gasPrice: ethers.parseUnits("600", "gwei")
    });
    
    console.log(`Transaction sent: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Verify transfer
    const newAdmin = await vault.admin();
    console.log(`\nNew vault admin: ${newAdmin}`);
    
    if (newAdmin.toLowerCase() === AGENT_EVM_ADDRESS.toLowerCase()) {
      console.log("\n✅ ADMIN TRANSFER SUCCESSFUL!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`✅ Agent (${AGENT_EVM_ADDRESS}) is now admin of IndexVault`);
      console.log(`✅ Agent can now execute setComposition() calls`);
      console.log(`✅ Minting functionality remains unaffected`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      // Save transfer info
      const transferInfo = {
        timestamp: new Date().toISOString(),
        previousAdmin: currentAdmin,
        newAdmin: AGENT_EVM_ADDRESS,
        vaultAddress: deploymentInfo.vaultEvm,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
      
      fs.writeFileSync("admin-transfer-info.json", JSON.stringify(transferInfo, null, 2));
      console.log("\n📄 Transfer details saved to admin-transfer-info.json");
      
    } else {
      console.error("\n❌ ADMIN TRANSFER FAILED!");
      console.error(`Expected: ${AGENT_EVM_ADDRESS}`);
      console.error(`Actual: ${newAdmin}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ Error transferring admin:", error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 