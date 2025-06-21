import { Client, PrivateKey, AccountId, ContractExecuteTransaction, ContractFunctionParameters, ContractId, Hbar } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function simpleMintTest() {
    console.log("🧪 Simple mint test to isolate INVALID_OPERATION...");
    
    // Initialize client
    const accountId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const privateKey = PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    const contractHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID!;
    const contractId = ContractId.fromString(contractHederaId);
    
    console.log("Contract ID:", contractHederaId);
    console.log("User Account:", accountId.toString());
    
    try {
        // Try the simplest possible mint call
        console.log("\n🚀 Attempting minimal mint call...");
        
        const mintTransaction = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(2000000)
            .setFunction(
                "mintWithDeposits",
                new ContractFunctionParameters()
                    .addUint256(100000000) // 1 LYNX (8 decimals)
                    .addUint256(5000000)   // 5 SAUCE (6 decimals) 
                    .addUint256(2000000)   // 2 CLXY (6 decimals)
            )
            .setPayableAmount(Hbar.fromTinybars(1000000000)) // 10 HBAR
            .setMaxTransactionFee(new Hbar(5));
            
        console.log("Executing mintWithDeposits...");
        const result = await mintTransaction.execute(client);
        const receipt = await result.getReceipt(client);
        
        console.log("✅ Success! Status:", receipt.status.toString());
        console.log("Transaction ID:", result.transactionId.toString());
        
    } catch (error) {
        console.error("❌ Error during mint test:");
        console.error(error);
        
        // Check for specific error types
        if (error instanceof Error) {
            if (error.message.includes("INVALID_OPERATION")) {
                console.error("\n🎯 INVALID_OPERATION detected!");
                console.error("This means one of the HTS operations in the contract is not allowed");
                console.error("Most likely: contract doesn't have supply key for LYNX token");
            }
            if (error.message.includes("INSUFFICIENT_ALLOWANCE")) {
                console.error("\n🎯 INSUFFICIENT_ALLOWANCE detected!");
                console.error("Need to approve tokens first");
            }
        }
    }
}

simpleMintTest().catch(console.error); 