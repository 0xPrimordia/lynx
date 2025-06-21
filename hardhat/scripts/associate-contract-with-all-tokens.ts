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
    console.log("🔗 Associating DepositMinter contract with all required tokens...");
    
    // Contract and token info
    const contractHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID;
    const lynxTokenId = "0.0.5948419";   // LYNX
    const sauceTokenId = "0.0.1183558";  // SAUCE
    const clxyTokenId = "0.0.5365";      // CLXY
    
    if (!contractHederaId) {
        throw new Error("NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID environment variable not set");
    }
    
    console.log(`Contract ID: ${contractHederaId}`);
    console.log(`LYNX Token ID: ${lynxTokenId}`);
    console.log(`SAUCE Token ID: ${sauceTokenId}`);
    console.log(`CLXY Token ID: ${clxyTokenId}`);
    
    // Setup Hedera credentials
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
    const operatorKey = process.env.OPERATOR_KEY || "";

    if (!operatorId || !operatorKey) {
        throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
    }

    console.log(`Using operator account: ${operatorId}`);

    try {
        // Initialize Hedera client
        const client = Client.forTestnet();
        const privateKey = PrivateKey.fromString(operatorKey);
        const accountId = AccountId.fromString(operatorId);
        
        client.setOperator(accountId, privateKey);

        const tokenIds = [lynxTokenId, sauceTokenId, clxyTokenId];
        const tokenNames = ["LYNX", "SAUCE", "CLXY"];

        // Associate all tokens with the contract in a single transaction
        console.log(`\n🔗 Associating all tokens with contract in single transaction...`);

        const associateTx = new TokenAssociateTransaction()
            .setAccountId(AccountId.fromString(contractHederaId))
            .setTokenIds(tokenIds.map(id => TokenId.fromString(id)))
            .setMaxTransactionFee(new Hbar(5))  // Higher fee for multiple associations
            .freezeWith(client);

        console.log(`📝 Executing token association transaction...`);
        const associateSubmit = await associateTx.execute(client);
        const associateRx = await associateSubmit.getReceipt(client);

        console.log(`✅ All tokens association completed!`);
        console.log(`Transaction ID: ${associateSubmit.transactionId?.toString()}`);
        console.log(`Status: ${associateRx.status.toString()}`);

        console.log("\n🎉 SUCCESS!");
        console.log(`The DepositMinter contract is now associated with:`);
        console.log(`- LYNX token (${lynxTokenId})`);
        console.log(`- SAUCE token (${sauceTokenId})`);
        console.log(`- CLXY token (${clxyTokenId})`);
        console.log(`The contract can now receive SAUCE and CLXY deposits and mint LYNX tokens.`);

        client.close();

    } catch (error) {
        console.error("❌ Error associating tokens:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            
            // Check for specific association errors
            if (error.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
                console.log("✅ Some or all tokens are already associated with the contract");
            } else if (error.message.includes("INVALID_ACCOUNT_ID")) {
                console.log("❌ Invalid contract account ID - check NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID");
            } else if (error.message.includes("INVALID_TOKEN_REF")) {
                console.log("❌ Invalid token ID - check token IDs are correct");
            }
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 