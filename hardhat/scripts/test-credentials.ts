import { Client, PrivateKey, AccountId, AccountBalanceQuery } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function testCredentials() {
    console.log("🔐 Testing credentials...");
    
    try {
        // Initialize client
        const accountId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
        const privateKey = PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY!);
        
        console.log("Account ID:", accountId.toString());
        console.log("Private Key (first 10 chars):", process.env.OPERATOR_KEY!.substring(0, 10) + "...");
        
        const client = Client.forTestnet();
        client.setOperator(accountId, privateKey);
        
        // Test with a simple balance query
        console.log("\n💰 Checking account balance...");
        const balance = await new AccountBalanceQuery()
            .setAccountId(accountId)
            .execute(client);
            
        console.log("✅ Credentials work!");
        console.log("HBAR Balance:", balance.hbars.toString());
        console.log("Token Balances:", balance.tokens?.toString() || "None");
        
    } catch (error) {
        console.error("❌ Credentials failed:");
        console.error(error);
    }
}

testCredentials().catch(console.error); 