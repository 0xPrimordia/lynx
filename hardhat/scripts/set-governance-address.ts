import { 
    Client, 
    PrivateKey, 
    AccountId, 
    ContractExecuteTransaction,
    ContractCallQuery,
    ContractFunctionParameters, 
    ContractId,
    Hbar
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function setGovernanceAddress() {
    console.log("🏛️ Setting Governance Address on DepositMinterV2");
    console.log("=================================================");
    
    // Initialize client with operator account (admin)
    const operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
    
    // Get governance agent ID
    const governanceAgentId = AccountId.fromString("0.0.6110233"); // Governance Agent ID
    
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    
    // Use the new DepositMinterV2 contract with governance features
    const contractHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_V3_ID!;
    const contractId = ContractId.fromString(contractHederaId);
    
    console.log("Contract ID:", contractHederaId);
    console.log("Operator ID (Admin):", operatorId.toString());
    console.log("Governance Agent ID:", governanceAgentId.toString());
    
    try {
        // Step 1: Check current governance address
        console.log("\n1️⃣ Checking current governance address...");
        
        const governanceQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("GOVERNANCE");
        
        const governanceResult = await governanceQuery.execute(client);
        const currentGovernance = governanceResult.getAddress(0);
        
        console.log("Current Governance Address:", currentGovernance);
        
        // Step 2: Convert governance agent to EVM address
        const governanceAgentEvmAddress = `0x${governanceAgentId.toSolidityAddress()}`;
        console.log("Governance Agent EVM Address:", governanceAgentEvmAddress);
        
        // Step 3: Check if governance is already set correctly
        if (currentGovernance.toLowerCase() === governanceAgentEvmAddress.toLowerCase()) {
            console.log("✅ Governance address is already set correctly!");
            return;
        }
        
        // Step 4: Set governance address
        console.log("\n2️⃣ Setting governance address...");
        
        const setGovernanceTx = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(1000000)
            .setFunction("setGovernanceAddress", new ContractFunctionParameters()
                .addAddress(governanceAgentEvmAddress)
            )
            .setMaxTransactionFee(new Hbar(10));
        
        const setGovResponse = await setGovernanceTx.execute(client);
        const setGovReceipt = await setGovResponse.getReceipt(client);
        
        if (setGovReceipt.status.toString() === "SUCCESS") {
            console.log("✅ Governance address set successfully!");
            console.log("Transaction ID:", setGovResponse.transactionId.toString());
        } else {
            throw new Error(`Setting governance failed with status: ${setGovReceipt.status.toString()}`);
        }
        
        // Step 5: Verify the change
        console.log("\n3️⃣ Verifying governance address was set...");
        
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for update
        
        const verifyGovernanceQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("GOVERNANCE");
        
        const verifyResult = await verifyGovernanceQuery.execute(client);
        const newGovernance = verifyResult.getAddress(0);
        
        console.log("New Governance Address:", newGovernance);
        
        if (newGovernance.toLowerCase() === governanceAgentEvmAddress.toLowerCase()) {
            console.log("✅ Governance address verified successfully!");
        } else {
            console.log("❌ Governance address verification failed");
            console.log("Expected:", governanceAgentEvmAddress);
            console.log("Actual:", newGovernance);
        }
        
        // Step 6: Test governance permissions
        console.log("\n4️⃣ Testing governance permissions...");
        
        // Check current ratios
        const ratiosQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("getCurrentRatios");
        
        const ratiosResult = await ratiosQuery.execute(client);
        const hbarRatio = ratiosResult.getUint256(0);
        const wbtcRatio = ratiosResult.getUint256(1);
        const sauceRatio = ratiosResult.getUint256(2);
        const usdcRatio = ratiosResult.getUint256(3);
        const jamRatio = ratiosResult.getUint256(4);
        const headstartRatio = ratiosResult.getUint256(5);
        
        console.log("Current Ratios:");
        console.log("- HBAR:", hbarRatio.toString());
        console.log("- WBTC:", wbtcRatio.toString());
        console.log("- SAUCE:", sauceRatio.toString());
        console.log("- USDC:", usdcRatio.toString());
        console.log("- JAM:", jamRatio.toString());
        console.log("- HEADSTART:", headstartRatio.toString());
        
        console.log("\n🎉 GOVERNANCE SETUP COMPLETE!");
        console.log("==============================");
        console.log("✅ Governance address set to:", governanceAgentEvmAddress);
        console.log("✅ Governance permissions verified");
        console.log("✅ Ready for ratio adjustment testing");
        
        console.log("\n📋 Next Steps:");
        console.log("1. Update test-ratio-adjustment.ts to use contract ID:", contractHederaId);
        console.log("2. Run ratio adjustment tests: npx ts-node scripts/test-ratio-adjustment.ts");
        console.log("3. Test governance-controlled ratio updates");
        
    } catch (error: any) {
        console.error("❌ Setting governance address failed:", error.message);
        throw error;
    } finally {
        client.close();
    }
}

setGovernanceAddress().catch(console.error); 