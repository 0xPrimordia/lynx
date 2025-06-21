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

async function testSimpleMinterIsolation() {
    console.log("🔍 Testing SimpleTokenMinter minting functionality in isolation...");
    
    // Initialize client with test account
    const accountId = AccountId.fromString(process.env.TEST_ACCOUNT!);
    const privateKey = PrivateKey.fromString(process.env.TEST_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    // Use the new SimpleTokenMinter - hardcoded to stop env issues
    const contractHederaId = "0.0.6205668";
    const contractId = ContractId.fromString(contractHederaId);
    
    // Get token info from environment
    const lynxTokenId = process.env.NEXT_PUBLIC_LYNX_TEST_TOKEN_ID!;
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID!;
    
    console.log("SimpleTokenMinter Contract ID:", contractHederaId);
    console.log("Test Account ID:", accountId.toString());
    console.log("Operator ID (Treasury):", operatorId);
    console.log("LYNX Token ID:", lynxTokenId);
    
    try {
        // Check initial token supply
        console.log("\n1️⃣ Checking initial token supply...");
        const initialSupplyResponse = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/tokens/${lynxTokenId}`);
        const initialSupplyData = await initialSupplyResponse.json();
        const initialSupply = initialSupplyData.total_supply;
        console.log("Initial total supply:", initialSupply);
        
        // Check initial balances
        console.log("\n2️⃣ Checking initial balances...");
        
        const checkBalance = async (accountId: string, tokenId: string) => {
            try {
                const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`);
                const data = await response.json();
                return data.tokens && data.tokens.length > 0 ? parseInt(data.tokens[0].balance) : 0;
            } catch (error) {
                return 0;
            }
        };
        
        const initialOperatorBalance = await checkBalance(operatorId, lynxTokenId);
        const initialContractBalance = await checkBalance(contractHederaId, lynxTokenId);
        
        console.log("Initial operator LYNX balance:", initialOperatorBalance);
        console.log("Initial contract LYNX balance:", initialContractBalance);
        
        // Test minting with SimpleTokenMinter
        console.log("\n3️⃣ Testing SimpleTokenMinter mint function...");
        
        const mintAmount = 100000000; // 1 LYNX with 8 decimals
        console.log("Minting amount (base units):", mintAmount);
        
        const mintTx = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(1000000) // Lower gas for simple contract
            .setFunction("mintTokens", new ContractFunctionParameters()
                .addInt64(mintAmount)
            )
            .setMaxTransactionFee(new Hbar(20));
        
        console.log("Executing mint transaction...");
        const mintResponse = await mintTx.execute(client);
        
        console.log("Transaction ID:", mintResponse.transactionId.toString());
        console.log("Waiting for receipt...");
        
        try {
            const mintReceipt = await mintResponse.getReceipt(client);
            console.log("✅ Transaction completed with status:", mintReceipt.status.toString());
        } catch (error: any) {
            console.log("❌ Transaction failed with error:", error.message);
            console.log("Status code:", error.status?._code);
            
            // Get detailed transaction info even if it failed
            const txId = mintResponse.transactionId.toString();
            const formattedTxId = txId.replace('@', '-').replace('.', '-');
            console.log("Check transaction details at:");
            console.log(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${formattedTxId}`);
        }
        
        // Wait a moment then check final supply and balances
        console.log("\n4️⃣ Waiting 5 seconds then checking results...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const finalSupplyResponse = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/tokens/${lynxTokenId}`);
        const finalSupplyData = await finalSupplyResponse.json();
        const finalSupply = finalSupplyData.total_supply;
        
        const finalOperatorBalance = await checkBalance(operatorId, lynxTokenId);
        const finalContractBalance = await checkBalance(contractHederaId, lynxTokenId);
        
        console.log("Final total supply:", finalSupply);
        console.log("Final operator LYNX balance:", finalOperatorBalance);
        console.log("Final contract LYNX balance:", finalContractBalance);
        
        // Analyze results
        console.log("\n5️⃣ Analysis...");
        
        const supplyChange = parseInt(finalSupply) - parseInt(initialSupply);
        const operatorBalanceChange = finalOperatorBalance - initialOperatorBalance;
        const contractBalanceChange = finalContractBalance - initialContractBalance;
        
        console.log("Supply change:", supplyChange);
        console.log("Operator balance change:", operatorBalanceChange);
        console.log("Contract balance change:", contractBalanceChange);
        
        if (supplyChange === 0) {
            console.log("❌ NO MINTING OCCURRED - Total supply unchanged");
            console.log("   This confirms minting is failing completely");
        } else if (supplyChange === mintAmount) {
            console.log("✅ MINTING SUCCEEDED - Supply increased by expected amount");
            
            if (operatorBalanceChange === mintAmount) {
                console.log("✅ Tokens went to OPERATOR (treasury) - This is expected behavior");
            } else if (contractBalanceChange === mintAmount) {
                console.log("✅ Tokens went to CONTRACT - This happens when contract mints");
            } else {
                console.log("❓ Tokens went somewhere unexpected");
                console.log("   Total minted:", supplyChange);
                console.log("   To operator:", operatorBalanceChange);
                console.log("   To contract:", contractBalanceChange);
            }
        } else {
            console.log(`❌ UNEXPECTED SUPPLY CHANGE - Expected ${mintAmount}, got ${supplyChange}`);
        }
        
        // Final conclusion
        console.log("\n🎯 CONCLUSION:");
        if (supplyChange === 0) {
            console.log("Minting is completely failing. Need to check:");
            console.log("- Supply key permissions");
            console.log("- Contract association with token");
            console.log("- HTS interface compatibility");
        } else {
            console.log("Minting works! The issue with DepositMinter is in the transfer logic.");
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

testSimpleMinterIsolation().catch(console.error); 