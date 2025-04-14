import { task } from "hardhat/config";
import { Hbar, AccountId, TransferTransaction, Client, PrivateKey, AccountBalanceQuery } from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

/**
 * Hardhat task to fund the controller contract with HBAR for token creation
 */
task("token:fund-controller", "Funds the controller contract with HBAR for token operations")
  .addOptionalParam("amount", "Amount of HBAR to fund", "10")
  .addOptionalParam("controller", "Controller contract ID (from deployment-info.json if not provided)")
  .setAction(async (taskArgs, hre) => {
    try {
      // Load environment variables
      dotenv.config({ path: path.join(__dirname, "../../.env.local") });
      
      // Get operator credentials
      const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
      const operatorKey = process.env.OPERATOR_KEY;
      
      if (!operatorId || !operatorKey) {
        console.error("Missing environment variables: NEXT_PUBLIC_OPERATOR_ID and/or OPERATOR_KEY");
        return;
      }
      
      console.log(`Using operator account: ${operatorId}`);
      
      // Initialize Hedera client
      const client = Client.forTestnet();
      client.setOperator(
        AccountId.fromString(operatorId),
        PrivateKey.fromString(operatorKey)
      );
      
      // Get controller ID
      let controllerId = taskArgs.controller;
      if (!controllerId) {
        // Get from deployment-info.json
        const deploymentInfoPath = path.join(__dirname, "../../deployment-info.json");
        if (fs.existsSync(deploymentInfoPath)) {
          const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, "utf8"));
          controllerId = deploymentInfo.controllerId;
        }
      }
      
      if (!controllerId) {
        console.error("Controller ID not provided and not found in deployment-info.json");
        return;
      }
      
      console.log(`Funding controller: ${controllerId}`);
      
      // Check current controller balance
      const balanceQuery = await new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(controllerId))
        .execute(client);
      console.log(`Current balance: ${balanceQuery.hbars.toString()}`);
      
      // Fund amount
      const fundAmount = new Hbar(parseFloat(taskArgs.amount));
      console.log(`Funding with: ${fundAmount.toString()}`);
      
      // Create transfer transaction
      const transferTx = new TransferTransaction()
        .addHbarTransfer(AccountId.fromString(operatorId), fundAmount.negated())
        .addHbarTransfer(AccountId.fromString(controllerId), fundAmount)
        .setTransactionMemo("Funding controller for token operations");
      
      // Execute transaction
      const submitTx = await transferTx.execute(client);
      console.log(`Transaction ID: ${submitTx.transactionId.toString()}`);
      
      // Get receipt
      const receipt = await submitTx.getReceipt(client);
      console.log(`Transaction status: ${receipt.status.toString()}`);
      
      // Check new balance
      const newBalanceQuery = await new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(controllerId))
        .execute(client);
      console.log(`New balance: ${newBalanceQuery.hbars.toString()}`);
      
      console.log("Funding complete!");
    } catch (error: any) {
      console.error("Error funding controller:", error.message || error);
    }
  });

export default {}; 