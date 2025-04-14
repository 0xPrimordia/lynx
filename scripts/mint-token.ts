import fs from "fs";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

/**
 * Mint Tokens Script
 * 
 * This script mints LYNX tokens to a specified address. With the updated contracts,
 * any user can mint tokens as long as they have sufficient deposits in the vault.
 * Admin rights are no longer required to mint tokens.
 */

// Load environment variables
dotenv.config({ path: ".env.local" });

async function main() {
  try {
    // Initialize provider
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    
    // Initialize signer from private key
    const operatorKey = process.env.OPERATOR_KEY;
    if (!operatorKey) {
      throw new Error("OPERATOR_KEY not found in environment variables");
    }
    
    const signer = new ethers.Wallet(operatorKey, provider);
    console.log("Minting from account:", signer.address);
    
    // Get deployment info
    const deploymentInfo = require('../deployment-info.json');
    const controllerId: string = deploymentInfo.controllerId;
    const tokenAddress: string = deploymentInfo.tokenAddress;
    
    // Convert Hedera controller ID to EVM address
    const accountNum = controllerId.split('.').pop() || "0";
    const paddedAccountNum = accountNum.padStart(40, '0');
    const controllerAddress = `0x${paddedAccountNum}`;
    
    console.log(`Controller ID: ${controllerId}`);
    console.log(`Controller Address: ${controllerAddress}`);
    console.log(`Token Address: ${tokenAddress}`);
    
    if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
      console.error("No token address in deployment info. Run create-token script first.");
      return;
    }
    
    // Get contract ABI
    const abi = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/app/contracts/IndexTokenController.sol/IndexTokenController.json'), 'utf8')).abi;
    const controller = new ethers.Contract(controllerAddress, abi, signer);
    
    // Recipient address (the address to receive tokens)
    // For testing, we can use our own account
    const recipient = signer.address;
    
    // Amount to mint (with 8 decimals as defined in the contract)
    const amount = ethers.parseUnits("100", 8); // 100 tokens
    
    console.log(`\nMinting ${ethers.formatUnits(amount, 8)} tokens to ${recipient}`);
    
    // Check if contract has supply key
    try {
      const hasSupplyKey = await controller.hasSupplyKey();
      console.log(`Controller has supply key: ${hasSupplyKey}`);
      
      if (!hasSupplyKey) {
        console.log("Controller doesn't have supply key. Minting will not be possible.");
        console.log("The controller must have the supply key to mint tokens.");
        return;
      }
    } catch (error) {
      console.error("Error checking supply key:", error);
      console.log("Continuing anyway...");
    }
    
    // Public token minting - Anyone can mint tokens with sufficient deposits
    console.log("\nThis contract supports public minting!");
    console.log("Any user with sufficient deposits in the vault can mint tokens.");
    
    // Check deposit requirements
    try {
      const requiredDeposits = await controller.getRequiredDeposits(amount);
      console.log("\nRequired deposits to mint this amount:");
      for (let i = 0; i < requiredDeposits.tokens.length; i++) {
        console.log(`Token: ${requiredDeposits.tokens[i]}`);
        console.log(`Amount: ${ethers.formatUnits(requiredDeposits.amounts[i], 8)}`);
      }
    } catch (error) {
      console.error("Could not retrieve required deposits:", error);
    }
    
    // Mint tokens - works for any user with sufficient deposits
    console.log("\nSending mint transaction...");
    const tx = await controller.mintTo(recipient, amount, {
      gasLimit: 500000,
      gasPrice: ethers.parseUnits("250", "gwei")
    });
    
    console.log(`Transaction hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed!");
    
    // Check for events
    for (const log of receipt.logs) {
      try {
        const parsedEvent = controller.interface.parseLog(log);
        if (parsedEvent) {
          console.log(`\nEvent: ${parsedEvent.name}`);
          console.log("Arguments:", JSON.stringify(parsedEvent.args, (key, value) => {
            if (typeof value === 'bigint') return value.toString();
            return value;
          }, 2));
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    console.log("\nMinting completed successfully!");
    
  } catch (error: any) {
    console.error("Error in minting script:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: any) => {
    console.error(error);
    process.exit(1);
  }); 