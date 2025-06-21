import { 
    Client, 
    AccountId, 
    PrivateKey, 
    AccountAllowanceApproveTransaction,
    TokenId,
    Hbar
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env.local" });

async function main() {
    console.log("🔑 Setting up vault allowance for DepositMinter using governance account...");
    
    // Get environment variables - using governance account for allowance
    const governanceAccountId = process.env.GOVERNANCE_ACCOUNT_ID!;
    const governanceKey = process.env.GOVERNANCE_KEY!;
    const lynxTokenId = process.env.NEXT_PUBLIC_LYNX_TOKEN_ID!;
    const depositMinterHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID!;
    
    // Vault Hedera ID (hardcoded since env has EVM address)
    const vaultHederaId = "0.0.5851446";
    
    if (!governanceAccountId || !governanceKey || !lynxTokenId || !depositMinterHederaId) {
        throw new Error("Missing required environment variables: GOVERNANCE_ACCOUNT_ID, GOVERNANCE_KEY, NEXT_PUBLIC_LYNX_TOKEN_ID, NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID");
    }
    
    console.log("LYNX Token ID:", lynxTokenId);
    console.log("DepositMinter Contract ID:", depositMinterHederaId);
    console.log("Vault Hedera ID:", vaultHederaId);
    console.log("Governance Account ID:", governanceAccountId);
    console.log("Governance EVM Address: 0x00000000000000000000000000000000005d3c19");
    
    // Setup client with governance account (the vault owner)
    const governanceAccountIdObj = AccountId.fromString(governanceAccountId);
    const governancePrivateKey = PrivateKey.fromString(governanceKey);
    const client = Client.forTestnet().setOperator(governanceAccountIdObj, governancePrivateKey);
    
    console.log("Governance EVM address:", governanceAccountIdObj.toSolidityAddress());
    
    try {
        // Set up allowance from vault to DepositMinter
        // This allows the DepositMinter to spend LYNX tokens from the vault
        console.log("\n💰 Setting vault allowance for DepositMinter...");
        
        // Set a large allowance (1 billion LYNX tokens in base units)
        const allowanceAmount = 100000000000000000; // 1 billion LYNX (8 decimals)
        
        const allowanceTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(
                TokenId.fromString(lynxTokenId),        // LYNX token
                AccountId.fromString(vaultHederaId),    // Vault (owner)
                AccountId.fromString(depositMinterHederaId), // DepositMinter (spender)
                allowanceAmount                         // Amount
            )
            .setMaxTransactionFee(new Hbar(5));
        
        console.log("Executing allowance transaction...");
        const response = await allowanceTx.execute(client);
        const receipt = await response.getReceipt(client);
        
        if (receipt.status.toString() !== "SUCCESS") {
            throw new Error(`Allowance transaction failed: ${receipt.status.toString()}`);
        }
        
        console.log("✅ Vault allowance set successfully!");
        console.log("Transaction ID:", response.transactionId.toString());
        console.log("Status:", receipt.status.toString());
        
        console.log("\n🎉 Setup complete!");
        console.log("The DepositMinter contract can now transfer LYNX tokens from the vault to users.");
        console.log(`Allowance set: ${allowanceAmount} LYNX base units`);
        console.log("This is a one-time setup - the allowance will persist on the network.");
        
    } catch (error: any) {
        console.error("❌ Failed to set vault allowance:", error);
        if (error.status) {
            console.error("Hedera Status:", error.status.toString());
        }
        throw error;
    } finally {
        client.close();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 