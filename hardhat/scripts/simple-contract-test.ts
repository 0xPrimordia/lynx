import { Client, PrivateKey, AccountId, ContractCallQuery, ContractFunctionParameters, ContractId, ContractExecuteTransaction, Hbar, AccountAllowanceApproveTransaction, TokenId, TransactionId } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function simpleContractTest() {
    console.log("🧪 Simple contract test...");
    
    // Initialize client using your working pattern
    const accountId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const privateKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);  // Use fromString, not fromStringECDSA
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    const contractHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID!;
    const contractId = ContractId.fromString(contractHederaId);
    
    console.log("Contract ID:", contractHederaId);
    console.log("Account ID:", accountId.toString());
    
    try {
        console.log("\n📊 Testing calculateRequiredDeposits (pure function)...");
        
        // This should work since it's a pure function
        const result = await new ContractCallQuery()
            .setContractId(contractId)
            .setGas(50000)
            .setFunction("calculateRequiredDeposits", 
                new ContractFunctionParameters().addUint256(100000000) // 1 LYNX
            )
            .execute(client);
            
        console.log("✅ Contract call successful!");
        console.log("Result bytes:", result.bytes);
        
        // Try to decode the results
        const sauceRequired = result.getUint256(0);
        const clxyRequired = result.getUint256(1); 
        const hbarRequired = result.getUint256(2);
        
        console.log("For 1 LYNX (100000000), required:");
        console.log("  SAUCE:", sauceRequired.toString());
        console.log("  CLXY:", clxyRequired.toString()); 
        console.log("  HBAR:", hbarRequired.toString());
        
        // Check if contract has token addresses set
        console.log("\n🔧 Checking contract token configuration...");
        
        const lynxQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("lynxToken");
        const lynxResult = await lynxQuery.execute(client);
        console.log("✅ Contract is properly configured");
        
        // Set allowances first
        console.log("\n💰 Setting token allowances...");
        
        // SAUCE allowance
        const sauceAllowanceTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(
                TokenId.fromString("0.0.1183558"), // SAUCE
                accountId,
                AccountId.fromString(contractHederaId),
                5000000 // 5 SAUCE (6 decimals)
            )
            .setTransactionId(TransactionId.generate(accountId))
            .setMaxTransactionFee(new Hbar(2));
            
        const sauceResult = await sauceAllowanceTx.execute(client);
        await sauceResult.getReceipt(client);
        console.log("✅ SAUCE allowance set");
        
        // CLXY allowance  
        const clxyAllowanceTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(
                TokenId.fromString("0.0.5365"), // CLXY
                accountId,
                AccountId.fromString(contractHederaId),
                2000000 // 2 CLXY (6 decimals)
            )
            .setTransactionId(TransactionId.generate(accountId))
            .setMaxTransactionFee(new Hbar(2));
            
        const clxyResult = await clxyAllowanceTx.execute(client);
        await clxyResult.getReceipt(client);
        console.log("✅ CLXY allowance set");
        
        // Now test the actual mint function
        console.log("\n🔥 Testing mintWithDeposits to reproduce INVALID_OPERATION...");
        
        const mintTx = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(2000000)
            .setFunction("mintWithDeposits",
                new ContractFunctionParameters()
                    .addUint256(100000000) // 1 LYNX
                    .addUint256(5000000)   // 5 SAUCE
                    .addUint256(2000000)   // 2 CLXY
            )
            .setPayableAmount(Hbar.fromTinybars(1000000000)) // 10 HBAR
            .setMaxTransactionFee(new Hbar(5));
            
        const mintResult = await mintTx.execute(client);
        const receipt = await mintResult.getReceipt(client);
        
        console.log("✅ Mint successful! Status:", receipt.status.toString());
        
    } catch (error) {
        console.error("❌ Contract test failed:");
        console.error(error);
        
        if (error instanceof Error) {
            if (error.message.includes('INVALID_OPERATION')) {
                console.error("\n🎯 INVALID_OPERATION found! This is one of these HTS calls:");
                console.error("1. hts.isTokenAssociated() - token association check");
                console.error("2. hts.allowance() - allowance check");  
                console.error("3. hts.transferToken() - SAUCE/CLXY transfer");
                console.error("4. hts.mintToken() - LYNX minting");
                console.error("5. hts.transferToken() - LYNX transfer to user");
            } else if (error.message.includes('CONTRACT_REVERT_EXECUTED')) {
                console.error("\n🔍 CONTRACT_REVERT_EXECUTED - Contract validation failed");
                console.error("Most likely causes:");
                console.error("- InsufficientDeposit: Wrong amount calculations");
                console.error("- TokenNotAssociated: Contract not associated with tokens");
                console.error("- TransferFailed: HTS transferToken() failed");
                console.error("- MintFailed: HTS mintToken() failed");
            }
        }
    }
}

simpleContractTest().catch(console.error); 