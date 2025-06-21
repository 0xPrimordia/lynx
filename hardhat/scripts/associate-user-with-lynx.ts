import { 
    Client, 
    PrivateKey, 
    AccountId, 
    TokenAssociateTransaction,
    TokenId,
    Hbar
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env.local" });

async function main() {
    console.log("🔗 Associating user account with LYNX token...");
    
    const lynxTokenId = "0.0.5948419";
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
    const operatorKey = process.env.OPERATOR_KEY || "";

    if (!operatorId || !operatorKey) {
        throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
    }

    console.log(`User Account: ${operatorId}`);
    console.log(`LYNX Token: ${lynxTokenId}`);

    try {
        // Initialize Hedera client
        const client = Client.forTestnet();
        client.setOperator(
            AccountId.fromString(operatorId),
            PrivateKey.fromString(operatorKey)
        );

        // Associate user account with LYNX token
        const associateTx = new TokenAssociateTransaction()
            .setAccountId(AccountId.fromString(operatorId))
            .setTokenIds([TokenId.fromString(lynxTokenId)])
            .setMaxTransactionFee(new Hbar(2))
            .freezeWith(client);

        console.log("\n📝 Executing association transaction...");
        const associateSubmit = await associateTx.execute(client);
        const associateRx = await associateSubmit.getReceipt(client);

        console.log("✅ LYNX token association completed!");
        console.log(`Transaction ID: ${associateSubmit.transactionId?.toString()}`);
        console.log(`Status: ${associateRx.status.toString()}`);

        console.log("\n🎉 SUCCESS!");
        console.log(`User account ${operatorId} is now associated with LYNX token ${lynxTokenId}`);
        console.log("The account can now receive minted LYNX tokens.");

        client.close();

    // Initialize client
    const accountId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const privateKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    try {
        // Associate with LYNX token
        const lynxTokenId = TokenId.fromString("0.0.5948419");
        
        console.log("Associating account", accountId.toString(), "with LYNX token", lynxTokenId.toString());
        
        const associateTx = new TokenAssociateTransaction()
            .setAccountId(accountId)
            .setTokenIds([lynxTokenId])
            .freezeWith(client);
        
        const signedTx = await associateTx.sign(privateKey);
        const associateResponse = await signedTx.execute(client);
        const associateReceipt = await associateResponse.getReceipt(client);
        
        console.log("✅ LYNX token association status:", associateReceipt.status.toString());
        console.log("Transaction ID:", associateResponse.transactionId.toString());
        
    } catch (error: any) {
        if (error.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
            console.log("✅ Account is already associated with LYNX token");
        } else {
            console.error("❌ Error associating with LYNX token:", error.message);
        }
    } finally {
        client.close();
    }
}

associateUserWithLynx()
    .then(() => {
        console.log("\n🎉 Association complete!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Association failed:", error);
        process.exit(1);
    }); 