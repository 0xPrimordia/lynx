import { ethers } from "hardhat";

// Constants for the tokens
const SAUCE_TOKEN_ID = process.env.SAUCE_TOKEN_ID || "0.0.1183558";
const CLXY_TOKEN_ID = process.env.CLXY_TOKEN_ID || "0.0.1318237";

// Helper to convert Hedera ID to EVM address
function hederaIdToEvmAddress(hederaId: string): string {
  const parts = hederaId.split('.');
  if (parts.length < 3) {
    throw new Error(`Invalid Hedera ID format: ${hederaId}`);
  }
  const num = parts[2];
  return `0x${num.padStart(40, '0')}`;
}

async function main() {
  try {
    const [signer] = await ethers.getSigners();
    console.log("Depositing assets from account:", signer.address);
    
    // Get deployment info
    const deploymentInfo = require('../deployment-info.json');
    const vaultId = deploymentInfo.vaultId;
    const vaultAddress = hederaIdToEvmAddress(vaultId);
    
    console.log(`Vault ID: ${vaultId}`);
    console.log(`Vault Address: ${vaultAddress}`);
    
    // Get vault contract
    const IndexVault = await ethers.getContractFactory("IndexVault");
    const vault = IndexVault.attach(vaultAddress);
    
    // Convert token IDs to EVM addresses
    const sauceAddress = hederaIdToEvmAddress(SAUCE_TOKEN_ID);
    const clxyAddress = hederaIdToEvmAddress(CLXY_TOKEN_ID);
    
    console.log("Token addresses:");
    console.log(`SAUCE: ${sauceAddress}`);
    console.log(`CLXY: ${clxyAddress}`);
    
    // Set amount to deposit (use a large number for testing)
    const sauceAmount = ethers.parseUnits("1000", 8); // Assuming 8 decimals
    const clxyAmount = ethers.parseUnits("1000", 8);   // Assuming 8 decimals
    
    // Mock the deposits for testing by setting the admin to bypass validation
    console.log("\nSetting admin for testing...");
    const setAdminTx = await vault.setAdmin(signer.address, {
      gasLimit: 200000,
      gasPrice: ethers.parseUnits("10", "gwei")
    });
    await setAdminTx.wait();
    console.log("Admin set successfully!");
    
    // Mock the deposits
    console.log(`\nSetting mock deposits for testing...`);
    
    // Since we can't easily transfer real tokens for test, we'll add a function to mock deposits
    const setSauceDepositTx = await vault.mockDeposit(signer.address, sauceAddress, sauceAmount, {
      gasLimit: 200000,
      gasPrice: ethers.parseUnits("10", "gwei")
    });
    await setSauceDepositTx.wait();
    console.log(`SAUCE deposit set: ${ethers.formatUnits(sauceAmount, 8)} tokens`);
    
    const setClxyDepositTx = await vault.mockDeposit(signer.address, clxyAddress, clxyAmount, {
      gasLimit: 200000,
      gasPrice: ethers.parseUnits("10", "gwei")
    });
    await setClxyDepositTx.wait();
    console.log(`CLXY deposit set: ${ethers.formatUnits(clxyAmount, 8)} tokens`);
    
    // Check if mintValidation would pass
    console.log("\nChecking if mintValidation would pass...");
    const lynxAmount = ethers.parseUnits("10", 8); // 10 LYNX tokens
    const canMint = await vault.validateMint(signer.address, lynxAmount);
    
    console.log(`Can mint ${ethers.formatUnits(lynxAmount, 8)} LYNX tokens: ${canMint}`);
    
    console.log("\nDeposit setup complete!");
    
  } catch (error) {
    console.error("Error setting up deposits:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 