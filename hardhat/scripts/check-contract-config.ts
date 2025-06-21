import { Client, PrivateKey, AccountId, ContractCallQuery, ContractId } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function checkContractConfig() {
    console.log("🔧 Checking DepositMinter contract configuration...");
    
    // Initialize client
    const accountId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const privateKey = PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    const contractHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID!;
    const contractId = ContractId.fromString(contractHederaId);
    
    console.log("Contract ID:", contractHederaId);
    
    try {
        // Check if contract exists by calling admin function
        console.log("\n1️⃣ Checking if contract exists...");
        const adminQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("admin");
        
        const adminResult = await adminQuery.execute(client);
        console.log("✅ Contract exists and responds");
        
        // Check token addresses
        console.log("\n2️⃣ Checking token addresses...");
        
        const lynxQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("lynxToken");
        const lynxResult = await lynxQuery.execute(client);
        console.log("LYNX token address:", lynxResult.getAddress(0));
        
        const sauceQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("sauceToken");
        const sauceResult = await sauceQuery.execute(client);
        console.log("SAUCE token address:", sauceResult.getAddress(0));
        
        const clxyQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("clxyToken");
        const clxyResult = await clxyQuery.execute(client);
        console.log("CLXY token address:", clxyResult.getAddress(0));
        
        console.log("\n✅ Contract configuration check complete!");
        
    } catch (error) {
        console.error("❌ Contract configuration check failed:");
        console.error(error);
        
        if (error instanceof Error && error.message.includes("INVALID_SIGNATURE")) {
            console.error("\n🚨 INVALID_SIGNATURE suggests:");
            console.error("   - Contract doesn't exist at this address");
            console.error("   - Wrong network (testnet vs mainnet)");
            console.error("   - Account/key mismatch");
        }
    }
}

checkContractConfig().catch(console.error); 