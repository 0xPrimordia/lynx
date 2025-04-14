import { task } from "hardhat/config";
import { HederaManager } from "../scripts/utils/hedera";
import { Hbar, ContractExecuteTransaction, ContractFunctionParameters, ContractCallQuery } from "@hashgraph/sdk";
import * as fs from "fs";
import * as path from "path";

/**
 * Hardhat task to create a token using the deployed controller contract
 * The token supports public minting - any user with sufficient deposits 
 * can mint tokens without requiring admin privileges.
 */
task("token:create-with-contract", "Creates a token using the deployed controller contract")
  .addParam("controller", "Controller contract ID")
  .addParam("name", "Token name")
  .addParam("symbol", "Token symbol")
  .addParam("memo", "Token memo")
  .setAction(async (taskArgs, hre) => {
    const hedera = HederaManager.getInstance();
    const client = hedera.getClient();
    const { controller, name, symbol, memo } = taskArgs;
    
    console.log(`Creating token using controller ${controller}:`);
    console.log(`- Name: ${name}`);
    console.log(`- Symbol: ${symbol}`);
    console.log(`- Memo: ${memo}`);
    
    try {
      // Check if token already exists
      console.log("\nChecking if token already exists...");
      const tokenQuery = await new ContractCallQuery()
        .setContractId(controller)
        .setFunction("getTokenAddress")
        .setGas(100000)
        .execute(client);
      
      // Parse the result - if not all zeros, token exists
      const tokenBytes = tokenQuery.getBytes();
      const isAllZeros = tokenBytes.every(byte => byte === 0);
      
      if (!isAllZeros) {
        console.log("Token already exists. Aborting creation.");
        return;
      }
      
      console.log("No existing token found. Proceeding with creation.");
      
      // Prepare function parameters for createIndexToken
      const params = new ContractFunctionParameters()
        .addString(name)
        .addString(symbol)
        .addString(memo);
      
      // Create the token via contract
      const tx = await new ContractExecuteTransaction()
        .setContractId(controller)
        .setFunction("createIndexToken", params)
        .setGas(1000000)
        .setPayableAmount(new Hbar(1)) // 1 HBAR for token creation fees
        .execute(client);
      
      console.log(`Transaction ID: ${tx.transactionId}`);
      
      // Wait for receipt
      const receipt = await tx.getReceipt(client);
      console.log(`Creation status: ${receipt.status}`);
      
      // Check if token was created
      const tokenCheckQuery = await new ContractCallQuery()
        .setContractId(controller)
        .setFunction("getTokenAddress")
        .setGas(100000)
        .execute(client);
      
      const newTokenBytes = tokenCheckQuery.getBytes();
      const newIsAllZeros = newTokenBytes.every(byte => byte === 0);
      
      if (!newIsAllZeros) {
        console.log("Token was successfully created!");
        console.log("This token supports public minting - any user with sufficient deposits can mint tokens.");
        
        // Get deployment info and update it
        const deploymentInfoPath = path.join(process.cwd(), "..", "deployment-info.json");
        const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, "utf-8"));
        
        // Format token address
        const tokenHex = Buffer.from(newTokenBytes).toString('hex');
        deploymentInfo.tokenAddress = `0x${tokenHex}`;
        
        fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
        console.log("Updated deployment-info.json with token address");
      } else {
        console.log("Token creation might have failed - address is still zero");
      }
      
      // Check if contract has supply key
      const hasSupplyKeyQuery = await new ContractCallQuery()
        .setContractId(controller)
        .setFunction("hasSupplyKey")
        .setGas(100000)
        .execute(client);
      
      const hasSupplyKey = hasSupplyKeyQuery.getBool(0);
      console.log(`Controller has supply key: ${hasSupplyKey}`);
      
    } catch (error: any) {
      console.error("Error creating token:", error.message || error);
    }
  }); 