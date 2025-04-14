import { ethers } from "hardhat";
import fs from "fs";

// Constants for the composition tokens
const SAUCE_TOKEN_ID = process.env.SAUCE_TOKEN_ID || "0.0.1183558";
const CLXY_TOKEN_ID = process.env.CLXY_TOKEN_ID || "0.0.1318237";

async function main() {
  try {
    const [signer] = await ethers.getSigners();
    console.log("Setting up vault from account:", signer.address);
    
    // Get deployment info
    const deploymentInfo = require('../deployment-info.json');
    const vaultId = deploymentInfo.vaultId;
    
    // Convert Hedera ID to EVM address
    const vaultParts = vaultId.split('.');
    if (vaultParts.length < 3) {
      throw new Error(`Invalid vault ID format: ${vaultId}`);
    }
    const accountNum = vaultParts[2];
    const paddedAccountNum = accountNum.padStart(40, '0');
    const vaultAddress = `0x${paddedAccountNum}`;
    
    console.log(`Vault ID: ${vaultId}`);
    console.log(`Vault Address: ${vaultAddress}`);
    
    // Get the vault contract
    const IndexVault = await ethers.getContractFactory("IndexVault");
    const vault = IndexVault.attach(vaultAddress);
    
    // Convert token IDs to EVM addresses
    const sauceParts = SAUCE_TOKEN_ID.split('.');
    if (sauceParts.length < 3) {
      throw new Error(`Invalid SAUCE token ID format: ${SAUCE_TOKEN_ID}`);
    }
    const sauceNum = sauceParts[2];
    const paddedSauceNum = sauceNum.padStart(40, '0');
    const sauceAddress = `0x${paddedSauceNum}`;
    
    const clxyParts = CLXY_TOKEN_ID.split('.');
    if (clxyParts.length < 3) {
      throw new Error(`Invalid CLXY token ID format: ${CLXY_TOKEN_ID}`);
    }
    const clxyNum = clxyParts[2];
    const paddedClxyNum = clxyNum.padStart(40, '0');
    const clxyAddress = `0x${paddedClxyNum}`;
    
    console.log("Setting composition with tokens:");
    console.log(`SAUCE: ${sauceAddress}`);
    console.log(`CLXY: ${clxyAddress}`);
    
    // Create composition array
    // Asset struct: {token: address, weight: uint16}
    // Total weight must be 10000 (100%)
    const composition = [
      [sauceAddress, 5000], // 50% SAUCE
      [clxyAddress, 5000]   // 50% CLXY
    ];
    
    // Set the composition
    console.log("\nSetting vault composition...");
    const tx = await vault.setComposition(composition, {
      gasLimit: 500000,
      gasPrice: ethers.parseUnits("10", "gwei")
    });
    
    console.log(`Transaction hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed!");
    
    // Verify the composition
    console.log("\nVerifying composition settings...");
    
    const asset0 = await vault.composition(0);
    const asset1 = await vault.composition(1);
    
    console.log("Composition 0:", {
      token: asset0[0],
      weight: asset0[1].toString()
    });
    
    console.log("Composition 1:", {
      token: asset1[0],
      weight: asset1[1].toString()
    });
    
    console.log("\nVault composition setup complete!");
    
  } catch (error) {
    console.error("Error setting up vault composition:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 