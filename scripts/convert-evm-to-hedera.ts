#!/usr/bin/env ts-node
import { ContractId } from "@hashgraph/sdk";
import * as fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Vault and Controller EVM addresses from deployment
const VAULT_EVM = "0x2327751935B8a96183F698e6625FEffbC81dd97e";
const CONTROLLER_EVM = "0xF714C429c5E210E27Cf5F40de3e892Fb8710923c";

async function main() {
  console.log("Converting EVM addresses to Hedera account IDs...");

  try {
    // Convert Vault EVM address to Hedera ID
    console.log(`\nVault EVM address: ${VAULT_EVM}`);
    const vaultContractId = ContractId.fromSolidityAddress(VAULT_EVM);
    const vaultId = vaultContractId.toString();
    console.log(`Vault Hedera ID: ${vaultId}`);

    // Convert Controller EVM address to Hedera ID
    console.log(`\nController EVM address: ${CONTROLLER_EVM}`);
    const controllerContractId = ContractId.fromSolidityAddress(CONTROLLER_EVM);
    const controllerId = controllerContractId.toString();
    console.log(`Controller Hedera ID: ${controllerId}`);

    // Update deployment-info.json
    const deploymentInfoPath = path.join(__dirname, '../deployment-info.json');
    let deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf8'));
    
    deploymentInfo.vaultId = vaultId;
    deploymentInfo.controllerId = controllerId;
    
    fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\nUpdated deployment-info.json with Hedera IDs");

    // Update .env.local
    const envPath = path.join(__dirname, '../.env.local');
    let envContent = '';
    
    try {
      envContent = fs.readFileSync(envPath, 'utf8');
    } catch (error) {
      console.warn("Could not read existing .env.local file. Creating new one.");
    }

    // Update or add environment variables
    const envVars = envContent.split('\n');
    const updatedVars: string[] = [];
    
    // Variables to update/add
    const varsToUpdate = {
      'NEXT_PUBLIC_VAULT_ID': vaultId,
      'NEXT_PUBLIC_LYNX_CONTRACT_ID': controllerId,
    };
    
    // Track which variables we've already updated
    const updatedKeys = new Set<string>();
    
    // Update existing variables
    for (const line of envVars) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        updatedVars.push(line); // Keep comments and empty lines
        continue;
      }
      
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex);
        if (varsToUpdate[key as keyof typeof varsToUpdate]) {
          updatedVars.push(`${key}=${varsToUpdate[key as keyof typeof varsToUpdate]}`);
          updatedKeys.add(key);
        } else {
          updatedVars.push(line); // Keep unchanged line
        }
      } else {
        updatedVars.push(line); // Keep line without equals
      }
    }
    
    // Add any variables that weren't in the original file
    for (const [key, value] of Object.entries(varsToUpdate)) {
      if (!updatedKeys.has(key)) {
        updatedVars.push(`${key}=${value}`);
      }
    }
    
    // Write updated content back to file
    fs.writeFileSync(envPath, updatedVars.join('\n'));
    console.log("Updated .env.local file with Hedera IDs");

    console.log("\nNext steps:");
    console.log("1. Fund the controller with HBAR (scripts/fund-contract.js)");
    console.log("2. Create the token (create-token.js)");
    console.log("3. Set up vault composition (scripts/setup-vault-composition.js)");
  } catch (error) {
    console.error("Error converting addresses:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 