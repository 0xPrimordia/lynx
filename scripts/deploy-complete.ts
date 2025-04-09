import { 
  Client, 
  AccountId, 
  PrivateKey, 
  ContractCreateFlow,
  ContractExecuteTransaction, 
  ContractFunctionParameters,
  Hbar,
  ContractCallQuery,
  AccountBalanceQuery,
  TransferTransaction
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Configuration
dotenv.config({ path: ".env.local" });
const OPERATOR_ID = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
const OPERATOR_KEY = process.env.OPERATOR_KEY || "";
const TOKEN_NAME = "Index Token";
const TOKEN_SYMBOL = "INDEX";
const TOKEN_MEMO = "Index Governance Token";

async function main() {
  try {
    console.log("🚀 ALL-IN-ONE DEPLOYMENT OF INDEX TOKEN SYSTEM");
    
    // Initialize client
    const client = Client.forTestnet();
    if (!OPERATOR_ID || !OPERATOR_KEY) {
      throw new Error("Missing operator credentials in .env.local");
    }
    client.setOperator(AccountId.fromString(OPERATOR_ID), PrivateKey.fromString(OPERATOR_KEY));
    console.log("✓ Client initialized");
    
    // Check initial balance
    const initialBalance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(OPERATOR_ID))
      .execute(client);
    console.log(`\nInitial account balance: ${initialBalance.hbars.toString()}`);
    
    if (initialBalance.hbars.toTinybars() < new Hbar(1).toTinybars()) {
      console.log("\n⚠️ WARNING: Low account balance. Please fund the account before continuing.");
      console.log("Current balance is below 1 HBAR which is the minimum required for deployment.");
      process.exit(1);
    }

    // STEP 1: Deploy IndexVault
    console.log("\n--- Deploying IndexVault ---");
    const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000";
    const vaultBytecode = require("../artifacts/app/contracts/IndexVault.sol/IndexVault.json").bytecode;
    
    const vaultDeployTx = await new ContractCreateFlow()
      .setGas(500000)  // Reduced gas
      .setConstructorParameters(new ContractFunctionParameters().addAddress(PLACEHOLDER_ADDRESS))
      .setBytecode(vaultBytecode)
      .execute(client);
    
    const vaultDeployReceipt = await vaultDeployTx.getReceipt(client);
    const vaultId = vaultDeployReceipt.contractId;
    if (!vaultId) throw new Error("Failed to get vault contract ID");
    console.log(`✓ IndexVault deployed at: ${vaultId.toString()}`);
    
    // Check balance after vault deployment
    const balanceAfterVault = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(OPERATOR_ID))
      .execute(client);
    console.log(`Balance after vault deployment: ${balanceAfterVault.hbars.toString()}`);
    
    if (balanceAfterVault.hbars.toTinybars() < new Hbar(1).toTinybars()) {
      console.log("\n⚠️ WARNING: Low account balance. Please fund the account before continuing.");
      process.exit(1);
    }
    
    // STEP 2: Deploy IndexTokenController
    console.log("\n--- Deploying IndexTokenController ---");
    const controllerBytecode = require("../artifacts/app/contracts/IndexTokenController.sol/IndexTokenController.json").bytecode;
    
    const controllerDeployTx = await new ContractCreateFlow()
      .setGas(500000)  // Reduced gas
      .setConstructorParameters(
        new ContractFunctionParameters()
          .addAddress(vaultId.toSolidityAddress())
          .addAddress("0x0000000000000000000000000000000000000167")
      )
      .setBytecode(controllerBytecode)
      .execute(client);
    
    const controllerDeployReceipt = await controllerDeployTx.getReceipt(client);
    const controllerId = controllerDeployReceipt.contractId;
    if (!controllerId) throw new Error("Failed to get controller contract ID");
    console.log(`✓ IndexTokenController deployed at: ${controllerId.toString()}`);
    
    // Check balance after controller deployment
    const balanceAfterController = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(OPERATOR_ID))
      .execute(client);
    console.log(`Balance after controller deployment: ${balanceAfterController.hbars.toString()}`);
    
    if (balanceAfterController.hbars.toTinybars() < new Hbar(1).toTinybars()) {
      console.log("\n⚠️ WARNING: Low account balance. Please fund the account before continuing.");
      process.exit(1);
    }
    
    // STEP 3: Connect the contracts
    console.log("\n--- Connecting vault to controller ---");
    const updateControllerTx = new ContractExecuteTransaction()
      .setContractId(vaultId)
      .setGas(100000)  // Minimal gas
      .setFunction(
        "updateController",
        new ContractFunctionParameters().addAddress(controllerId.toSolidityAddress())
      );
    
    const updateControllerReceipt = await (await updateControllerTx.execute(client)).getReceipt(client);
    console.log(`✓ Controller updated in vault: ${updateControllerReceipt.status.toString()}`);
    
    // Check balance after connection
    const balanceAfterConnection = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(OPERATOR_ID))
      .execute(client);
    console.log(`Balance after contract connection: ${balanceAfterConnection.hbars.toString()}`);
    
    if (balanceAfterConnection.hbars.toTinybars() < new Hbar(1).toTinybars()) {
      console.log("\n⚠️ WARNING: Low account balance. Please fund the account before continuing.");
      process.exit(1);
    }
    
    // Wait a moment for network sync
    console.log("\n--- Waiting 5 seconds for network sync ---");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // STEP 4: Create token with minimal settings
    console.log("\n--- Creating index token ---");
    try {
      // First check if we have enough balance
      const accountBalance = await new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(OPERATOR_ID))
        .execute(client);
      console.log(`Current account balance: ${accountBalance.hbars.toString()}`);
      
      if (accountBalance.hbars.toTinybars() < new Hbar(1).toTinybars()) {
        console.log("\n⚠️ WARNING: Insufficient balance for token creation. Please fund the account.");
        process.exit(1);
      }

      // Check and fund the contract
      const contractBalance = await new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(controllerId.toString()))
        .execute(client);
      console.log(`Contract balance before funding: ${contractBalance.hbars.toString()}`);
      
      // Fund the contract with HBAR for token creation
      if (contractBalance.hbars.toTinybars() < new Hbar(0.5).toTinybars()) {
        console.log("\nFunding contract with HBAR...");
        const fundingTx = await new TransferTransaction()
          .addHbarTransfer(AccountId.fromString(OPERATOR_ID), new Hbar(-2))  // Send 2 HBAR
          .addHbarTransfer(AccountId.fromString(controllerId.toString()), new Hbar(2))
          .execute(client);
        
        const fundingReceipt = await fundingTx.getReceipt(client);
        console.log(`Funding status: ${fundingReceipt.status.toString()}`);
        
        // Wait for funding to settle
        console.log("Waiting 2 seconds for funding to settle...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check new balance
        const newBalance = await new AccountBalanceQuery()
          .setAccountId(AccountId.fromString(controllerId.toString()))
          .execute(client);
        console.log(`Contract balance after funding: ${newBalance.hbars.toString()}`);
      }

      const createTokenTx = new ContractExecuteTransaction()
        .setContractId(controllerId)
        .setGas(500000)  // Minimal gas
        .setPayableAmount(new Hbar(1))  // Minimal token creation fee
        .setFunction(
          "createIndexToken",
          new ContractFunctionParameters()
            .addString("Lynx Index Token")
            .addString("LYNX")
            .addString("Lynx Protocol Index Token")
        );
      
      console.log("\nExecuting token creation transaction...");
      console.log(`Using contract ID: ${controllerId.toString()}`);
      console.log(`Gas limit: ${500000}`);
      console.log(`Token creation fee: 1 HBAR`);
      
      // Execute the transaction
      console.log("\nExecuting transaction...");
      const tokenCreateResponse = await createTokenTx.execute(client);
      console.log(`Transaction ID: ${tokenCreateResponse.transactionId.toString()}`);
      
      // Wait a moment for network sync
      console.log("\nWaiting 5 seconds for network sync...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get both receipt and record for better error information
      console.log("\nGetting transaction receipt...");
      const tokenCreateReceipt = await tokenCreateResponse.getReceipt(client);
      console.log(`Transaction status: ${tokenCreateReceipt.status.toString()}`);
      
      console.log("\nGetting transaction record...");
      const tokenCreateRecord = await tokenCreateResponse.getRecord(client);
      
      if (tokenCreateRecord.contractFunctionResult) {
        console.log("\nContract call result:");
        console.log(`- Gas used: ${tokenCreateRecord.contractFunctionResult.gasUsed}`);
        if (tokenCreateRecord.contractFunctionResult.errorMessage) {
          console.log(`- Error message: ${tokenCreateRecord.contractFunctionResult.errorMessage}`);
        }
        console.log(`- Raw result: ${tokenCreateRecord.contractFunctionResult.bytes}`);
        
        // Try to get the token address right after creation
        try {
          const tokenQuery = new ContractCallQuery()
            .setContractId(controllerId)
            .setGas(100000)
            .setFunction("getTokenAddress");
          
          const tokenResult = await tokenQuery.execute(client);
          const tokenAddress = tokenResult.getAddress();
          console.log(`\nToken address from query: ${tokenAddress}`);
        } catch (error) {
          console.log("\nFailed to get token address:", error);
        }
      }
      
      // Check contract balance after token creation
      const contractBalanceAfter = await new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(controllerId.toString()))
        .execute(client);
      console.log(`\nContract balance after token creation: ${contractBalanceAfter.hbars.toString()}`);
      
      // Get deployment results
      console.log("\n--- Getting deployment results ---");
      console.log(`IndexVault: ${vaultId.toString()}`);
      console.log(`IndexTokenController: ${controllerId.toString()}`);
      
      try {
        const tokenQuery = new ContractCallQuery()
          .setContractId(controllerId)
          .setGas(100000)
          .setFunction("getTokenAddress");
        
        const tokenResult = await tokenQuery.execute(client);
        const tokenAddress = tokenResult.getAddress();
        console.log(`Token Address: ${tokenAddress}`);
        console.log("\nAdd these values to your .env.local file!");
      } catch (error) {
        console.log("Failed to get token address:", error);
        console.log("\nUpdate .env.local with contract values and try token creation separately:");
        console.log(`NEXT_PUBLIC_INDEX_VAULT_ID=${vaultId.toString()}`);
        console.log(`NEXT_PUBLIC_INDEX_CONTROLLER_ID=${controllerId.toString()}`);
      }
    } catch (error: any) {
      console.error("Detailed error in token creation:", error);
      if (typeof error === 'object' && error !== null && 'transactionId' in error) {
        console.log(`Transaction ID: ${error.transactionId}`);
      }
      console.log("\nUpdate .env.local with contract values and try token creation separately:");
      console.log(`NEXT_PUBLIC_INDEX_VAULT_ID=${vaultId.toString()}`);
      console.log(`NEXT_PUBLIC_INDEX_CONTROLLER_ID=${controllerId.toString()}`);
    }
    
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main(); 