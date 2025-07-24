import {
    Client,
    AccountId,
    PrivateKey,
    ContractCallQuery,
    ContractId
} from "@hashgraph/sdk";

async function checkCurrentRatios() {
    console.log("🔍 Checking current contract ratios...\n");
    
    // Get environment variables
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    const contractHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_V2_HEDERA_ID || "0.0.6213127";
    
    if (!operatorId || !operatorKey) {
        throw new Error("Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID, OPERATOR_KEY");
    }
    
    // Create client
    const client = Client.forTestnet();
    client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromString(operatorKey));
    
    try {
        console.log(`📋 Contract Address: ${contractHederaId}\n`);
        
        // Query current ratios
        const ratiosQuery = new ContractCallQuery()
            .setContractId(ContractId.fromString(contractHederaId))
            .setGas(100000)
            .setFunction("getCurrentRatios");
        
        const ratiosResult = await ratiosQuery.execute(client);
        
        // Extract ratios
        const hbarRatio = ratiosResult.getUint256(0);
        const wbtcRatio = ratiosResult.getUint256(1);
        const sauceRatio = ratiosResult.getUint256(2);
        const usdcRatio = ratiosResult.getUint256(3);
        const jamRatio = ratiosResult.getUint256(4);
        const headstartRatio = ratiosResult.getUint256(5);
        
        console.log("📊 Current Token Ratios:");
        console.log("========================");
        console.log(`🪙 HBAR:      ${hbarRatio.toString()}`);
        console.log(`₿ WBTC:       ${wbtcRatio.toString()}`);
        console.log(`🌶️ SAUCE:     ${sauceRatio.toString()}`);
        console.log(`💵 USDC:      ${usdcRatio.toString()}`);
        console.log(`🍯 JAM:       ${jamRatio.toString()}`);
        console.log(`🚀 HEADSTART: ${headstartRatio.toString()}`);
        
        console.log("\n📈 Ratio Interpretation:");
        console.log("========================");
        console.log(`• ${hbarRatio.toString()} HBAR tinybars per LYNX token`);
        console.log(`• ${wbtcRatio.toString()} WBTC satoshis per LYNX token`);
        console.log(`• ${sauceRatio.toString()} SAUCE tokens per LYNX token`);
        console.log(`• ${usdcRatio.toString()} USDC tokens per LYNX token`);
        console.log(`• ${jamRatio.toString()} JAM tokens per LYNX token`);
        console.log(`• ${headstartRatio.toString()} HEADSTART tokens per LYNX token`);
        
        // Calculate percentages (assuming total should be 100)
        const totalRatio = parseInt(hbarRatio.toString()) + 
                          parseInt(wbtcRatio.toString()) + 
                          parseInt(sauceRatio.toString()) + 
                          parseInt(usdcRatio.toString()) + 
                          parseInt(jamRatio.toString()) + 
                          parseInt(headstartRatio.toString());
        
        console.log("\n📊 Allocation Percentages:");
        console.log("==========================");
        console.log(`🪙 HBAR:      ${((parseInt(hbarRatio.toString()) / totalRatio) * 100).toFixed(1)}%`);
        console.log(`₿ WBTC:       ${((parseInt(wbtcRatio.toString()) / totalRatio) * 100).toFixed(1)}%`);
        console.log(`🌶️ SAUCE:     ${((parseInt(sauceRatio.toString()) / totalRatio) * 100).toFixed(1)}%`);
        console.log(`💵 USDC:      ${((parseInt(usdcRatio.toString()) / totalRatio) * 100).toFixed(1)}%`);
        console.log(`🍯 JAM:       ${((parseInt(jamRatio.toString()) / totalRatio) * 100).toFixed(1)}%`);
        console.log(`🚀 HEADSTART: ${((parseInt(headstartRatio.toString()) / totalRatio) * 100).toFixed(1)}%`);
        console.log(`📊 TOTAL:     ${totalRatio} (100.0%)`);
        
    } catch (error) {
        console.error("❌ Error checking ratios:", error);
        throw error;
    } finally {
        client.close();
    }
}

// Run the check
checkCurrentRatios()
    .then(() => {
        console.log("\n✅ Ratio check completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Failed to check ratios:", error);
        process.exit(1);
    }); 