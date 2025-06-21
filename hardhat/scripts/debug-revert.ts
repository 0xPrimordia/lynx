import { 
    Client, 
    PrivateKey, 
    AccountId, 
    TransactionId,
    TransactionRecordQuery
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function debugRevert() {
    console.log("🔍 Debugging contract revert...");
    
    // Initialize client
    const accountId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const privateKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    try {
        // The transaction ID from the failed test
        const failedTxId = TransactionId.fromString("0.0.4340026@1750374307.032753813");
        
        console.log("Getting transaction record for:", failedTxId.toString());
        
        const recordQuery = new TransactionRecordQuery()
            .setTransactionId(failedTxId);
        
        const record = await recordQuery.execute(client);
        
        console.log("\n📋 Transaction Record Details:");
        console.log("Status:", record.receipt.status.toString());
        console.log("Gas used:", record.contractFunctionResult?.gasUsed?.toString() || "N/A");
        console.log("Error message:", record.contractFunctionResult?.errorMessage || "No error message");
        
        // Contract function result available
        if (record.contractFunctionResult) {
            console.log("Contract function result available: Yes");
        }
        
        // Try to decode the revert reason if available
        if (record.contractFunctionResult?.errorMessage) {
            console.log("\n🚨 Contract Error Message:");
            console.log(record.contractFunctionResult.errorMessage);
        } else {
            console.log("\n❌ No specific error message available");
        }
        
        // Check if there are any logs/events
        if (record.contractFunctionResult?.logs && record.contractFunctionResult.logs.length > 0) {
            console.log("\n📝 Contract Logs/Events:");
            record.contractFunctionResult.logs.forEach((log, index) => {
                console.log(`Log ${index}: ${log.data.length} bytes`);
            });
        } else {
            console.log("\n📝 No contract logs/events emitted");
        }
        
    } catch (error: any) {
        console.error("❌ Error getting transaction record:", error.message);
    } finally {
        client.close();
    }
}

debugRevert().catch(console.error); 