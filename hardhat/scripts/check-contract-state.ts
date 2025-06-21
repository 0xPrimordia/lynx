import { 
    Client, 
    PrivateKey, 
    AccountId, 
    ContractCallQuery,
    ContractId
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function checkContractState() {
    console.log("🔍 Checking DepositMinter contract state...");
    
    // Initialize client
    const accountId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const privateKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    const contractId = ContractId.fromString(process.env.NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID!);
    console.log("Contract ID:", contractId.toString());
    
    try {
        // Check LYNX token address
        console.log("\n1️⃣ Checking LYNX token address...");
        const lynxQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("lynxToken");
        
        const lynxResult = await lynxQuery.execute(client);
        const lynxAddress = lynxResult.getAddress(0);
        console.log("LYNX token address:", lynxAddress);
        console.log("Expected LYNX address: 0x00000000000000000000000000000000005Ac403");
        
        // Check SAUCE token address
        console.log("\n2️⃣ Checking SAUCE token address...");
        const sauceQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("sauceToken");
        
        const sauceResult = await sauceQuery.execute(client);
        const sauceAddress = sauceResult.getAddress(0);
        console.log("SAUCE token address:", sauceAddress);
        console.log("Expected SAUCE address: 0x00000000000000000000000000000000001210B6");
        
        // Check CLXY token address
        console.log("\n3️⃣ Checking CLXY token address...");
        const clxyQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("clxyToken");
        
        const clxyResult = await clxyQuery.execute(client);
        const clxyAddress = clxyResult.getAddress(0);
        console.log("CLXY token address:", clxyAddress);
        console.log("Expected CLXY address: 0x00000000000000000000000000000000000014f5");
        
        // Check contract associations using the debug function
        console.log("\n4️⃣ Checking contract token associations...");
        try {
            const associationsQuery = new ContractCallQuery()
                .setContractId(contractId)
                .setGas(200000)
                .setFunction("checkAllAssociations");
            
            const associationsResult = await associationsQuery.execute(client);
            const sauceAssociated = associationsResult.getBool(0);
            const clxyAssociated = associationsResult.getBool(1);
            const lynxAssociated = associationsResult.getBool(2);
            
            console.log("Contract SAUCE associated:", sauceAssociated);
            console.log("Contract CLXY associated:", clxyAssociated);
            console.log("Contract LYNX associated:", lynxAssociated);
            
            const allAssociated = sauceAssociated && clxyAssociated && lynxAssociated;
            console.log("All tokens associated with contract:", allAssociated);
            
            if (!allAssociated) {
                console.log("❌ CONTRACT ASSOCIATION ISSUE FOUND!");
                console.log("This is likely the root cause of the CONTRACT_REVERT_EXECUTED error");
            }
            
        } catch (associationError: any) {
            console.log("❌ Could not check associations:", associationError.message);
        }
        
    } catch (error: any) {
        console.error("❌ Error checking contract state:", error.message);
    } finally {
        client.close();
    }
}

checkContractState()
    .then(() => {
        console.log("\n🔍 Contract state check complete!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Contract state check failed:", error);
        process.exit(1);
    }); 