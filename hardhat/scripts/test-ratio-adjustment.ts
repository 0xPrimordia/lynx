import { 
    Client, 
    PrivateKey, 
    AccountId, 
    ContractCallQuery, 
    ContractExecuteTransaction,
    ContractFunctionParameters, 
    ContractId,
    Hbar
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function testRatioAdjustment() {
    console.log("🔍 Testing DepositMinterV2 - Ratio Adjustment Functionality");
    console.log("===========================================================");
    
    // Initialize client with operator account (admin)
    const operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
    
    // Initialize client with test account (will be governance)
    const testAccountId = AccountId.fromString(process.env.TEST_ACCOUNT!);
    const testPrivateKey = PrivateKey.fromString(process.env.TEST_KEY!);
    
    const client = Client.forTestnet();
    
    // Use the DepositMinterV2 contract with governance features
    const contractHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_V3_ID || "0.0.6216949"; // Latest DepositMinterV2 contract with governance
    const contractId = ContractId.fromString(contractHederaId);
    
    console.log("Contract ID:", contractHederaId);
    console.log("Operator ID (Admin):", operatorId.toString());
    console.log("Test Account ID (Future Governance):", testAccountId.toString());
    
    try {
        // Step 1: Check current contract admin and governance
        console.log("\n1️⃣ Checking current contract access control...");
        client.setOperator(operatorId, operatorKey);
        
        const adminQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("ADMIN");
        
        const adminResult = await adminQuery.execute(client);
        const currentAdmin = adminResult.getAddress(0);
        
        const governanceQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("GOVERNANCE");
        
        const governanceResult = await governanceQuery.execute(client);
        const currentGovernance = governanceResult.getAddress(0);
        
        console.log("Current Admin:", currentAdmin);
        console.log("Current Governance:", currentGovernance);
        
        // Step 2: Get initial ratios
        console.log("\n2️⃣ Getting initial ratios...");
        
        const ratiosQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("getCurrentRatios");
        
        const ratiosResult = await ratiosQuery.execute(client);
        const initialHbarRatio = ratiosResult.getUint256(0);
        const initialWbtcRatio = ratiosResult.getUint256(1);
        const initialSauceRatio = ratiosResult.getUint256(2);
        const initialUsdcRatio = ratiosResult.getUint256(3);
        const initialJamRatio = ratiosResult.getUint256(4);
        const initialHeadstartRatio = ratiosResult.getUint256(5);
        
        console.log("Initial Ratios:");
        console.log("- HBAR:", initialHbarRatio.toString());
        console.log("- WBTC:", initialWbtcRatio.toString());
        console.log("- SAUCE:", initialSauceRatio.toString());
        console.log("- USDC:", initialUsdcRatio.toString());
        console.log("- JAM:", initialJamRatio.toString());
        console.log("- HEADSTART:", initialHeadstartRatio.toString());
        
        // Step 3: Test calculations with initial ratios
        console.log("\n3️⃣ Testing calculations with initial ratios...");
        
        const lynxAmount = 1; // 1 LYNX
        const depositsQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("calculateRequiredDeposits", new ContractFunctionParameters().addUint256(lynxAmount));
        
        const depositsResult = await depositsQuery.execute(client);
        const initialHbarRequired = depositsResult.getUint256(0);
        const initialWbtcRequired = depositsResult.getUint256(1);
        const initialSauceRequired = depositsResult.getUint256(2);
        const initialUsdcRequired = depositsResult.getUint256(3);
        const initialJamRequired = depositsResult.getUint256(4);
        const initialHeadstartRequired = depositsResult.getUint256(5);
        
        console.log("Required deposits for 1 LYNX (initial ratios):");
        console.log("- HBAR:", initialHbarRequired.toString());
        console.log("- WBTC:", initialWbtcRequired.toString());
        console.log("- SAUCE:", initialSauceRequired.toString());
        console.log("- USDC:", initialUsdcRequired.toString());
        console.log("- JAM:", initialJamRequired.toString());
        console.log("- HEADSTART:", initialHeadstartRequired.toString());
        
        // Step 4: Set governance address (if not already set)
        console.log("\n4️⃣ Setting up governance address...");
        
        const testAccountEvmAddress = `0x${testAccountId.toSolidityAddress()}`;
        console.log("Test account EVM address:", testAccountEvmAddress);
        
        if (currentGovernance === "0x0000000000000000000000000000000000000000") {
            console.log("Setting governance address...");
            
            const setGovernanceTx = new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(1000000)
                .setFunction("setGovernanceAddress", new ContractFunctionParameters()
                    .addAddress(testAccountEvmAddress)
                )
                .setMaxTransactionFee(new Hbar(10));
            
            const setGovResponse = await setGovernanceTx.execute(client);
            await setGovResponse.getReceipt(client);
            
            console.log("✅ Governance address set successfully");
        } else if (currentGovernance.toLowerCase() === testAccountEvmAddress.toLowerCase()) {
            console.log("✅ Governance address already set correctly");
        } else {
            console.log("⚠️ Governance address is set to different account:", currentGovernance);
            console.log("⚠️ Will test admin emergency override instead");
        }
        
        // Step 5: Test governance ratio update
        console.log("\n5️⃣ Testing governance ratio update...");
        
        // Switch to governance account
        client.setOperator(testAccountId, testPrivateKey);
        
        // New ratios (doubled for easy verification)
        const newRatios = {
            hbar: parseInt(initialHbarRatio.toString()) * 2,      // Double HBAR ratio
            wbtc: parseInt(initialWbtcRatio.toString()) * 2,      // Double WBTC ratio
            sauce: parseInt(initialSauceRatio.toString()) * 2,    // Double SAUCE ratio
            usdc: parseInt(initialUsdcRatio.toString()) * 2,      // Double USDC ratio
            jam: parseInt(initialJamRatio.toString()) * 2,        // Double JAM ratio
            headstart: parseInt(initialHeadstartRatio.toString()) * 2 // Double HEADSTART ratio
        };
        
        console.log("Attempting to update ratios to (doubled values):");
        console.log("- HBAR:", newRatios.hbar);
        console.log("- WBTC:", newRatios.wbtc);
        console.log("- SAUCE:", newRatios.sauce);
        console.log("- USDC:", newRatios.usdc);
        console.log("- JAM:", newRatios.jam);
        console.log("- HEADSTART:", newRatios.headstart);
        
        try {
            const updateRatiosTx = new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(1000000)
                .setFunction("updateRatios", new ContractFunctionParameters()
                    .addUint256(newRatios.hbar)
                    .addUint256(newRatios.wbtc)
                    .addUint256(newRatios.sauce)
                    .addUint256(newRatios.usdc)
                    .addUint256(newRatios.jam)
                    .addUint256(newRatios.headstart)
                )
                .setMaxTransactionFee(new Hbar(10));
            
            const updateResponse = await updateRatiosTx.execute(client);
            const updateReceipt = await updateResponse.getReceipt(client);
            
            if (updateReceipt.status.toString() === "SUCCESS") {
                console.log("✅ Governance ratio update successful!");
                console.log("Transaction ID:", updateResponse.transactionId.toString());
            } else {
                throw new Error(`Update failed with status: ${updateReceipt.status.toString()}`);
            }
        } catch (error: any) {
            console.log("❌ Governance update failed:", error.message);
            console.log("Will test admin emergency override instead...");
            
            // Step 5b: Test admin emergency override
            console.log("\n5️⃣b Testing admin emergency override...");
            
            // Switch back to admin account
            client.setOperator(operatorId, operatorKey);
            
            const adminUpdateTx = new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(1000000)
                .setFunction("adminUpdateRatios", new ContractFunctionParameters()
                    .addUint256(newRatios.hbar)
                    .addUint256(newRatios.wbtc)
                    .addUint256(newRatios.sauce)
                    .addUint256(newRatios.usdc)
                    .addUint256(newRatios.jam)
                    .addUint256(newRatios.headstart)
                )
                .setMaxTransactionFee(new Hbar(10));
            
            const adminUpdateResponse = await adminUpdateTx.execute(client);
            const adminUpdateReceipt = await adminUpdateResponse.getReceipt(client);
            
            if (adminUpdateReceipt.status.toString() === "SUCCESS") {
                console.log("✅ Admin emergency ratio update successful!");
                console.log("Transaction ID:", adminUpdateResponse.transactionId.toString());
            } else {
                throw new Error(`Admin update failed with status: ${adminUpdateReceipt.status.toString()}`);
            }
        }
        
        // Step 6: Verify ratios were updated
        console.log("\n6️⃣ Verifying ratios were updated...");
        
        // Switch back to operator for queries
        client.setOperator(operatorId, operatorKey);
        
        const updatedRatiosQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("getCurrentRatios");
        
        const updatedRatiosResult = await updatedRatiosQuery.execute(client);
        const updatedHbarRatio = updatedRatiosResult.getUint256(0);
        const updatedWbtcRatio = updatedRatiosResult.getUint256(1);
        const updatedSauceRatio = updatedRatiosResult.getUint256(2);
        const updatedUsdcRatio = updatedRatiosResult.getUint256(3);
        const updatedJamRatio = updatedRatiosResult.getUint256(4);
        const updatedHeadstartRatio = updatedRatiosResult.getUint256(5);
        
        console.log("Updated Ratios:");
        console.log("- HBAR:", updatedHbarRatio.toString());
        console.log("- WBTC:", updatedWbtcRatio.toString());
        console.log("- SAUCE:", updatedSauceRatio.toString());
        console.log("- USDC:", updatedUsdcRatio.toString());
        console.log("- JAM:", updatedJamRatio.toString());
        console.log("- HEADSTART:", updatedHeadstartRatio.toString());
        
        // Step 7: Test calculations with new ratios
        console.log("\n7️⃣ Testing calculations with new ratios...");
        
        const newDepositsQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("calculateRequiredDeposits", new ContractFunctionParameters().addUint256(lynxAmount));
        
        const newDepositsResult = await newDepositsQuery.execute(client);
        const newHbarRequired = newDepositsResult.getUint256(0);
        const newWbtcRequired = newDepositsResult.getUint256(1);
        const newSauceRequired = newDepositsResult.getUint256(2);
        const newUsdcRequired = newDepositsResult.getUint256(3);
        const newJamRequired = newDepositsResult.getUint256(4);
        const newHeadstartRequired = newDepositsResult.getUint256(5);
        
        console.log("Required deposits for 1 LYNX (new ratios):");
        console.log("- HBAR:", newHbarRequired.toString());
        console.log("- WBTC:", newWbtcRequired.toString());
        console.log("- SAUCE:", newSauceRequired.toString());
        console.log("- USDC:", newUsdcRequired.toString());
        console.log("- JAM:", newJamRequired.toString());
        console.log("- HEADSTART:", newHeadstartRequired.toString());
        
        // Step 8: Analyze results
        console.log("\n8️⃣ Analyzing results...");
        
        const ratiosUpdatedCorrectly = 
            parseInt(updatedHbarRatio.toString()) === newRatios.hbar &&
            parseInt(updatedWbtcRatio.toString()) === newRatios.wbtc &&
            parseInt(updatedSauceRatio.toString()) === newRatios.sauce &&
            parseInt(updatedUsdcRatio.toString()) === newRatios.usdc &&
            parseInt(updatedJamRatio.toString()) === newRatios.jam &&
            parseInt(updatedHeadstartRatio.toString()) === newRatios.headstart;
        
        if (ratiosUpdatedCorrectly) {
            console.log("✅ Ratios updated correctly!");
        } else {
            console.log("❌ Ratios were not updated correctly");
        }
        
        // Check if calculations doubled (approximately)
        const hbarDoubled = parseInt(newHbarRequired.toString()) === parseInt(initialHbarRequired.toString()) * 2;
        const wbtcDoubled = parseInt(newWbtcRequired.toString()) === parseInt(initialWbtcRequired.toString()) * 2;
        const sauceDoubled = parseInt(newSauceRequired.toString()) === parseInt(initialSauceRequired.toString()) * 2;
        const usdcDoubled = parseInt(newUsdcRequired.toString()) === parseInt(initialUsdcRequired.toString()) * 2;
        const jamDoubled = parseInt(newJamRequired.toString()) === parseInt(initialJamRequired.toString()) * 2;
        const headstartDoubled = parseInt(newHeadstartRequired.toString()) === parseInt(initialHeadstartRequired.toString()) * 2;
        
        console.log("\nCalculation verification (should all be doubled):");
        console.log("- HBAR doubled:", hbarDoubled ? "✅" : "❌");
        console.log("- WBTC doubled:", wbtcDoubled ? "✅" : "❌");
        console.log("- SAUCE doubled:", sauceDoubled ? "✅" : "❌");
        console.log("- USDC doubled:", usdcDoubled ? "✅" : "❌");
        console.log("- JAM doubled:", jamDoubled ? "✅" : "❌");
        console.log("- HEADSTART doubled:", headstartDoubled ? "✅" : "❌");
        
        const allCalculationsCorrect = hbarDoubled && wbtcDoubled && sauceDoubled && usdcDoubled && jamDoubled && headstartDoubled;
        
        if (allCalculationsCorrect) {
            console.log("✅ All calculations use the new ratios correctly!");
        } else {
            console.log("❌ Some calculations are not using the new ratios");
        }
        
        // Step 9: Reset ratios to original values
        console.log("\n9️⃣ Resetting ratios to original values...");
        
        const resetTx = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(1000000)
            .setFunction("adminUpdateRatios", new ContractFunctionParameters()
                .addUint256(parseInt(initialHbarRatio.toString()))
                .addUint256(parseInt(initialWbtcRatio.toString()))
                .addUint256(parseInt(initialSauceRatio.toString()))
                .addUint256(parseInt(initialUsdcRatio.toString()))
                .addUint256(parseInt(initialJamRatio.toString()))
                .addUint256(parseInt(initialHeadstartRatio.toString()))
            )
            .setMaxTransactionFee(new Hbar(10));
        
        const resetResponse = await resetTx.execute(client);
        await resetResponse.getReceipt(client);
        
        console.log("✅ Ratios reset to original values");
        
        // Final verdict
        console.log("\n🎯 FINAL RESULTS:");
        console.log("================");
        
        if (ratiosUpdatedCorrectly && allCalculationsCorrect) {
            console.log("🎉 SUCCESS! Ratio adjustment functionality is working perfectly!");
            console.log("   ✅ Ratios can be updated via governance or admin");
            console.log("   ✅ Updated ratios are stored correctly");
            console.log("   ✅ Calculations use the new ratios immediately");
            console.log("   ✅ All 6 tokens (HBAR, WBTC, SAUCE, USDC, JAM, HEADSTART) work correctly");
        } else {
            console.log("❌ ISSUES DETECTED with ratio adjustment functionality!");
            if (!ratiosUpdatedCorrectly) {
                console.log("   ❌ Ratios were not updated correctly");
            }
            if (!allCalculationsCorrect) {
                console.log("   ❌ Calculations are not using the new ratios");
            }
        }
        
    } catch (error: any) {
        console.error("❌ Test failed:", error.message);
        if (error.status) {
            console.error("Status:", error.status.toString());
        }
        throw error;
    } finally {
        client.close();
    }
}

// Run the test
testRatioAdjustment().catch(console.error); 