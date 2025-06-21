import { 
    Client, 
    AccountId, 
    PrivateKey, 
    ContractCallQuery,
    ContractId
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env.local" });

async function main() {
    console.log("🔍 Checking vault admin...");
    
    // Setup client with operator account
    const operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromStringED25519(process.env.OPERATOR_KEY!);
    const client = Client.forTestnet().setOperator(operatorId, operatorKey);
    
    const vaultHederaId = "0.0.5851446";
    const vaultContractId = ContractId.fromString(vaultHederaId);
    
    console.log("Vault Contract ID:", vaultHederaId);
    
    try {
        // Query the admin of the vault contract
        console.log("\n🔍 Querying vault admin...");
        
        const adminQuery = new ContractCallQuery()
            .setContractId(vaultContractId)
            .setGas(100000)
            .setFunction("admin");
        
        const adminResult = await adminQuery.execute(client);
        
        // Get the raw result and log it
        console.log("Raw admin result:", adminResult);
        console.log("Admin result bytes:", adminResult.bytes);
        
        // Try different ways to extract the address
        try {
            const adminAddress = adminResult.getAddress(0);
            console.log("Admin address (method 1):", adminAddress);
        } catch (e) {
            console.log("Method 1 failed:", e);
        }
        
        try {
            const adminBytes = adminResult.getBytes32(0);
            console.log("Admin bytes32:", adminBytes);
            // Convert bytes32 to address (last 20 bytes)
            const addressBytes = adminBytes.slice(-20);
            const adminAddress = "0x" + Buffer.from(addressBytes).toString('hex');
            console.log("Admin address (from bytes32):", adminAddress);
        } catch (e) {
            console.log("Bytes32 method failed:", e);
        }
        
        // Check if it matches operator
        const operatorEVMAddress = "0x" + operatorId.toSolidityAddress();
        console.log("Operator EVM address:", operatorEVMAddress);
        
    } catch (error: any) {
        console.error("❌ Failed to query vault admin:", error);
        if (error.status) {
            console.error("Hedera Status:", error.status.toString());
        }
        
        // Let's try querying the controller instead to see if that works
        console.log("\n🔍 Trying to query controller...");
        try {
            const controllerQuery = new ContractCallQuery()
                .setContractId(vaultContractId)
                .setGas(100000)
                .setFunction("controller");
            
            const controllerResult = await controllerQuery.execute(client);
            const controllerAddress = controllerResult.getAddress(0);
            console.log("Controller address:", controllerAddress);
        } catch (controllerError) {
            console.log("Controller query failed:", controllerError);
        }
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