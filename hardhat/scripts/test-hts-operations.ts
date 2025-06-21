import { 
    Client, 
    PrivateKey, 
    AccountId, 
    ContractCallQuery, 
    ContractExecuteTransaction,
    ContractFunctionParameters, 
    ContractId,
    AccountAllowanceApproveTransaction,
    TokenAssociateTransaction,
    Hbar,
    TokenId
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

/**
 * Check token balances via mirror node API
 */
async function checkBalanceViaMirror(accountId: string, tokenId: string): Promise<number> {
    try {
        const response = await fetch(
            `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`
        );
        const data = await response.json();
        
        if (data.tokens && data.tokens.length > 0) {
            return parseInt(data.tokens[0].balance);
        }
        return 0;
    } catch (error) {
        console.error(`Error checking balance for ${tokenId}:`, error);
        return 0;
    }
}

async function testDepositMinterOperations() {
    console.log("🔍 Testing DepositMinter - verifying minting and deposits...");
    
    // Initialize client with test account
    const accountId = AccountId.fromString(process.env.TEST_ACCOUNT!);
    const privateKey = PrivateKey.fromString(process.env.TEST_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    const contractHederaId = "0.0.6206049"; // New DepositMinter contract with treasury fix
    const contractId = ContractId.fromString(contractHederaId);
    
    // Get token info from environment
    const lynxTokenId = process.env.NEXT_PUBLIC_LYNX_TOKEN_ID!;
    const sauceTokenId = process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID!;
    const clxyTokenId = process.env.NEXT_PUBLIC_CLXY_TOKEN_ID!;
    
    // Get operator ID for balance checking
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID!;
    
    console.log("Contract ID:", contractHederaId);
    console.log("Test Account ID:", accountId.toString());
    console.log("Operator ID (Treasury):", operatorId);
    console.log("LYNX Token ID:", lynxTokenId);
    
    try {
        // Step 1: Get required deposit amounts
        console.log("\n1️⃣ Getting required deposit amounts...");
        const depositsQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("calculateRequiredDeposits", new ContractFunctionParameters().addUint256(1));
        
        const depositsResult = await depositsQuery.execute(client);
        const sauceRequired = depositsResult.getUint256(0);
        const clxyRequired = depositsResult.getUint256(1);
        const hbarRequired = depositsResult.getUint256(2);
        
        console.log("Required deposits for 1 LYNX:");
        console.log("- SAUCE:", sauceRequired.toString());
        console.log("- CLXY:", clxyRequired.toString()); 
        console.log("- HBAR:", hbarRequired.toString());
        
        // Step 2: Check initial balances - INCLUDING OPERATOR (TREASURY)
        console.log("\n2️⃣ Checking initial balances...");
        
        const initialUserLynx = await checkBalanceViaMirror(accountId.toString(), lynxTokenId);
        const initialContractLynx = await checkBalanceViaMirror(contractHederaId, lynxTokenId);
        const initialOperatorLynx = await checkBalanceViaMirror(operatorId, lynxTokenId);
        const initialContractSauce = await checkBalanceViaMirror(contractHederaId, sauceTokenId);
        const initialContractClxy = await checkBalanceViaMirror(contractHederaId, clxyTokenId);
        
        console.log("Initial balances:");
        console.log("- User LYNX:", initialUserLynx);
        console.log("- Contract LYNX:", initialContractLynx);
        console.log("- Operator LYNX (Treasury):", initialOperatorLynx);
        console.log("- Contract SAUCE:", initialContractSauce);
        console.log("- Contract CLXY:", initialContractClxy);
        
        // Step 3: Set token allowances
        console.log("\n3️⃣ Setting token allowances...");
        
        const sauceAllowanceTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(sauceTokenId, accountId, contractId, parseInt(sauceRequired.toString()))
            .setMaxTransactionFee(new Hbar(5));
        
        await sauceAllowanceTx.execute(client);
        console.log("✅ SAUCE allowance set");
        
        const clxyAllowanceTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(clxyTokenId, accountId, contractId, parseInt(clxyRequired.toString()))
            .setMaxTransactionFee(new Hbar(5));
        
        await clxyAllowanceTx.execute(client);
        console.log("✅ CLXY allowance set");
        
        // Step 4: Ensure user is associated with LYNX token
        console.log("\n4️⃣ Ensuring LYNX token association...");
        
        try {
            const lynxTokenAssociateTx = new TokenAssociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([TokenId.fromString(lynxTokenId)])
                .setMaxTransactionFee(new Hbar(2));
            
            await lynxTokenAssociateTx.execute(client);
            console.log("✅ LYNX token associated");
        } catch (error: any) {
            if (error.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT")) {
                console.log("✅ LYNX token already associated");
            } else {
                throw error;
            }
        }
        
        // Step 5: Execute minting transaction
        console.log("\n5️⃣ Executing minting transaction...");
        
        const mintTx = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(3000000)
            .setPayableAmount(Hbar.fromTinybars(hbarRequired))
            .setFunction("mintWithDeposits", new ContractFunctionParameters()
                .addUint256(1) // 1 LYNX
                .addUint256(sauceRequired)
                .addUint256(clxyRequired)
            )
            .setMaxTransactionFee(new Hbar(50));
        
        const mintResponse = await mintTx.execute(client);
        const mintReceipt = await mintResponse.getReceipt(client);
        
        if (mintReceipt.status.toString() !== "SUCCESS") {
            throw new Error(`Minting failed with status: ${mintReceipt.status.toString()}`);
        }
        
        console.log("✅ Minting transaction successful!");
        console.log("Transaction ID:", mintResponse.transactionId.toString());
        
        // Step 6: Wait and check final balances - INCLUDING OPERATOR (TREASURY)
        console.log("\n6️⃣ Waiting 5 seconds then checking final balances...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const finalUserLynx = await checkBalanceViaMirror(accountId.toString(), lynxTokenId);
        const finalContractLynx = await checkBalanceViaMirror(contractHederaId, lynxTokenId);
        const finalOperatorLynx = await checkBalanceViaMirror(operatorId, lynxTokenId);
        const finalContractSauce = await checkBalanceViaMirror(contractHederaId, sauceTokenId);
        const finalContractClxy = await checkBalanceViaMirror(contractHederaId, clxyTokenId);
        
        console.log("Final balances:");
        console.log("- User LYNX:", finalUserLynx);
        console.log("- Contract LYNX:", finalContractLynx);
        console.log("- Operator LYNX (Treasury):", finalOperatorLynx);
        console.log("- Contract SAUCE:", finalContractSauce);
        console.log("- Contract CLXY:", finalContractClxy);
        
        // Step 7: Analyze what happened with minting
        console.log("\n7️⃣ Analyzing minting results...");
        
        const lynxMintedToUser = finalUserLynx - initialUserLynx;
        const lynxMintedToContract = finalContractLynx - initialContractLynx;
        const lynxMintedToOperator = finalOperatorLynx - initialOperatorLynx;
        const sauceDeposited = finalContractSauce - initialContractSauce;
        const clxyDeposited = finalContractClxy - initialContractClxy;
        
        console.log("LYNX Token Changes:");
        console.log("- LYNX to User:", lynxMintedToUser);
        console.log("- LYNX to Contract:", lynxMintedToContract);
        console.log("- LYNX to Operator (Treasury):", lynxMintedToOperator);
        console.log("- Total LYNX minted:", lynxMintedToUser + lynxMintedToContract + lynxMintedToOperator);
        
        console.log("\nDeposit Changes:");
        console.log("- SAUCE deposited to contract:", sauceDeposited);
        console.log("- CLXY deposited to contract:", clxyDeposited);
        
        // Step 8: Determine what actually happened
        console.log("\n8️⃣ Diagnosis...");
        
        const expectedLynxMinted = 100000000; // 1 LYNX with 8 decimals
        const expectedSauceDeposited = parseInt(sauceRequired.toString());
        const expectedClxyDeposited = parseInt(clxyRequired.toString());
        
        // Check if minting happened at all
        const totalLynxMinted = lynxMintedToUser + lynxMintedToContract + lynxMintedToOperator;
        
        if (totalLynxMinted === 0) {
            console.log("❌ MINTING FAILED - No LYNX tokens were minted anywhere!");
            console.log("   This suggests the mintToken() call in the contract failed");
        } else if (totalLynxMinted === expectedLynxMinted) {
            console.log("✅ MINTING SUCCEEDED - Correct amount of LYNX was minted");
            
            if (lynxMintedToUser === expectedLynxMinted) {
                console.log("✅ Tokens correctly transferred to user");
            } else if (lynxMintedToOperator === expectedLynxMinted) {
                console.log("❌ Tokens went to OPERATOR (treasury) - transfer to user failed");
                console.log("   Contract should transfer from operator to user, not contract to user");
            } else if (lynxMintedToContract === expectedLynxMinted) {
                console.log("❌ Tokens went to CONTRACT - this shouldn't happen with operator as treasury");
                console.log("   This suggests minting behavior is different than expected");
            } else {
                console.log("❌ Tokens were split between accounts - unexpected behavior");
            }
        } else {
            console.log(`❌ WRONG AMOUNT MINTED - Expected ${expectedLynxMinted}, got ${totalLynxMinted}`);
        }
        
        // Check deposits
        if (sauceDeposited === expectedSauceDeposited && clxyDeposited === expectedClxyDeposited) {
            console.log("✅ Deposits were taken correctly");
        } else {
            console.log("❌ Deposits were not taken correctly");
        }
        
        // Final verdict
        console.log("\n🎯 CONCLUSION:");
        if (totalLynxMinted === 0) {
            console.log("The contract's mintToken() call is failing. Check contract supply key permissions.");
        } else if (lynxMintedToUser === expectedLynxMinted) {
            console.log("Everything is working correctly!");
        } else if (lynxMintedToOperator > 0) {
            console.log("Minting works, but tokens go to treasury (operator). Contract needs to transfer from operator, not from itself.");
        } else {
            console.log("Unexpected minting pattern detected. Need to investigate further.");
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

testDepositMinterOperations().catch(console.error); 