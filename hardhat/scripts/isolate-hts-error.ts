import { Client, PrivateKey, AccountId, ContractExecuteTransaction, ContractCallQuery, ContractFunctionParameters, Hbar, AccountAllowanceApproveTransaction } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function isolateHtsError() {
    console.log("🔍 HTS Error Isolation Test - Testing each HTS operation individually");
    
    // Setup client
    const operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    
    // Contract and token addresses
    const contractId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID!;
    const lynxToken = "0.0.5948419";
    const sauceToken = "0.0.1183558"; 
    const clxyToken = "0.0.5365";
    
    console.log(`Contract: ${contractId}`);
    console.log(`Account: ${operatorId}`);
    console.log(`LYNX: ${lynxToken}, SAUCE: ${sauceToken}, CLXY: ${clxyToken}`);
    
    try {
                // Go straight to the actual failing function
        console.log("\n🧪 Testing mintWithDeposits - the actual problem...");
        
        // First set allowances
        console.log("Setting allowances first...");
        const sauceAllowance = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(
                AccountId.fromString(sauceToken),
                operatorId,
                AccountId.fromString(contractId),
                5000000
            );
        
        const clxyAllowance = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(
                AccountId.fromString(clxyToken),
                operatorId,
                AccountId.fromString(contractId),
                2000000
            );
        
        try {
            await sauceAllowance.execute(client);
            await clxyAllowance.execute(client);
            console.log("✅ Allowances set");
        } catch (error: any) {
            console.log("❌ Allowance setting failed:", error.message);
        }
        
                         // Now call mintWithDeposits and get the real error
        console.log("\n🧪 Calling mintWithDeposits...");
         const mintTest = new ContractExecuteTransaction()
             .setContractId(contractId)
             .setGas(2000000)
             .setFunction("mintWithDeposits", 
                 new ContractFunctionParameters()
                     .addUint256(100000000)  // 1 LYNX
                     .addUint256(5000000)    // 5 SAUCE  
                     .addUint256(2000000)    // 2 CLXY
             )
             .setPayableAmount(Hbar.fromTinybars(1000000000)); // 10 HBAR
         
         try {
             const mintResponse = await mintTest.execute(client);
             const mintReceipt = await mintResponse.getReceipt(client);
             console.log("✅ mintWithDeposits succeeded - unexpected!");
                 } catch (error: any) {
            console.log("❌ mintWithDeposits failed:", error.message);
            
            // Print the entire error object to see what's available
            console.log("Full error object keys:", Object.keys(error));
            
            if (error.transactionReceipt) {
                console.log("Transaction receipt keys:", Object.keys(error.transactionReceipt));
                
                if (error.transactionReceipt.contractFunctionResult) {
                    const result = error.transactionReceipt.contractFunctionResult;
                    console.log("Contract function result keys:", Object.keys(result));
                    console.log("Error message:", result.errorMessage);
                    console.log("Bytes:", result.bytes);
                } else {
                    console.log("No contractFunctionResult in receipt");
                }
            }
            
            // Also check if there's a different way to get the error
            if (error.receipt) {
                console.log("Error has receipt property");
            }
            
            if (error.transactionRecord) {
                console.log("Error has transactionRecord property");
            }
        }
        
    } catch (error: any) {
        console.error("❌ Test setup failed:", error.message);
    }
    
    client.close();
}

isolateHtsError().catch(console.error); 