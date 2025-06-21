import { 
    Client, 
    PrivateKey, 
    AccountId, 
    TokenAssociateTransaction,
    TokenId,
    TransactionId,
    Hbar
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function main() {
    console.log("🔗 Associating SimpleTokenMinter with test token using Hedera SDK...");
    
    // Initialize client
    const accountId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const privateKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    // Get SimpleTokenMinter contract Hedera ID from environment
    const contractHederaId = process.env.NEXT_PUBLIC_SIMPLE_MINTER_ID!;
    const contractAccountId = AccountId.fromString(contractHederaId);
    
    console.log("SimpleTokenMinter Contract Hedera ID:", contractHederaId);
    console.log("Operator account:", accountId.toString());
    
    // Test token ID to associate
    const testTokenId = TokenId.fromString(process.env.NEXT_PUBLIC_LYNX_TEST_TOKEN_ID!);
    
    console.log("Test token ID:", testTokenId.toString());
    
    try {
        console.log(`\n🔗 Associating LYNX test token (${testTokenId.toString()}) with SimpleTokenMinter...`);
        
        const associateTx = new TokenAssociateTransaction()
            .setAccountId(contractAccountId)
            .setTokenIds([testTokenId])
            .setTransactionId(TransactionId.generate(accountId))
            .setMaxTransactionFee(new Hbar(2))
            .freezeWith(client);
        
        const associateSubmit = await associateTx.execute(client);
        const associateRx = await associateSubmit.getReceipt(client);
        
        console.log(`✅ LYNX test token associated - Status: ${associateRx.status.toString()}`);
        console.log(`Transaction ID: ${associateSubmit.transactionId?.toString()}`);
        
        console.log("\n🎉 SimpleTokenMinter successfully associated with test token!");
        
    } catch (error: any) {
        console.error("❌ Error associating token:", error.message);
        if (error.status) {
            console.error("Status:", error.status.toString());
        }
        
        // Check if it's already associated
        if (error.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
            console.log("✅ Token was already associated with the contract");
        }
    } finally {
        client.close();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    }); 