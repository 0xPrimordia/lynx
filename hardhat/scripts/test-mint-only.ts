import { 
    Client, 
    PrivateKey, 
    AccountId, 
    ContractCallQuery, 
    ContractExecuteTransaction,
    ContractFunctionParameters, 
    ContractId,
    Hbar
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function testMintOnly() {
    console.log("🔍 Testing ONLY the minting functionality...");
    
    // Initialize client with test account
    const accountId = AccountId.fromString(process.env.TEST_ACCOUNT!);
    const privateKey = PrivateKey.fromString(process.env.TEST_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    const contractHederaId = "0.0.6202622"; // Contract with enhanced logging
    const contractId = ContractId.fromString(contractHederaId);
    
    console.log("Contract ID:", contractHederaId);
    console.log("Test Account ID:", accountId.toString());
    
    try {
        // Step 1: Try to call mintToken directly on the contract with minimal parameters
        console.log("\n1️⃣ Testing direct mint call...");
        
        // Use a very simple call - just try to mint 1 token (100000000 base units)
        const mintTx = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(3000000)
            .setFunction("mintTokens", new ContractFunctionParameters().addInt64(100000000)) // 1 LYNX in base units
            .setMaxTransactionFee(new Hbar(50));
        
        console.log("Executing mint transaction...");
        const mintResponse = await mintTx.execute(client);
        const mintReceipt = await mintResponse.getReceipt(client);
        
        console.log("Transaction ID:", mintResponse.transactionId.toString());
        console.log("Status:", mintReceipt.status.toString());
        
        if (mintReceipt.status.toString() === "SUCCESS") {
            console.log("✅ Direct minting succeeded!");
        } else {
            console.log("❌ Direct minting failed with status:", mintReceipt.status.toString());
        }
        
    } catch (error: any) {
        console.error("❌ Test failed:", error.message);
        if (error.status) {
            console.error("Status:", error.status.toString());
        }
        
        // Get the transaction ID for mirror node lookup
        if (error.transactionId) {
            console.log("Transaction ID for mirror node lookup:", error.transactionId.toString());
        }
    } finally {
        client.close();
    }
}

testMintOnly().catch(console.error); 