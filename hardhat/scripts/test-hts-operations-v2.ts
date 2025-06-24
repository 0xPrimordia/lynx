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

async function testDepositMinterV2Operations() {
    console.log("🔍 Testing DepositMinterV2 V3 - verifying 6-token minting with governance features...");
    
    // Initialize client with test account
    const accountId = AccountId.fromString(process.env.TEST_ACCOUNT!);
    const privateKey = PrivateKey.fromString(process.env.TEST_KEY!);
    
    const client = Client.forTestnet();
    client.setOperator(accountId, privateKey);
    
    // Use the new DepositMinterV2 V3 contract with governance features
    const contractHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_V3_ID || "0.0.6216949";
    const contractId = ContractId.fromString(contractHederaId);
    
    // Get token info from environment - using main LYNX token
    const lynxTokenId = process.env.NEXT_PUBLIC_LYNX_TOKEN_ID || "0.0.6200902"; // Main LYNX token
    const sauceTokenId = process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID!;
    const wbtcTokenId = process.env.NEXT_PUBLIC_WBTC_TOKEN_ID!;
    const usdcTokenId = process.env.NEXT_PUBLIC_USDC_TOKEN_ID!;
    const jamTokenId = process.env.NEXT_PUBLIC_JAM_TOKEN_ID!;
    const headstartTokenId = process.env.NEXT_PUBLIC_HEADSTART_TOKEN_ID!;
    
    // Get operator ID for balance checking
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID!;
    
    console.log("Contract ID (V3 with Governance):", contractHederaId);
    console.log("Test Account ID:", accountId.toString());
    console.log("Operator ID (Treasury):", operatorId);
    console.log("LYNX Token ID:", lynxTokenId);
    console.log("Token IDs:", {
        SAUCE: sauceTokenId,
        WBTC: wbtcTokenId,
        USDC: usdcTokenId,
        JAM: jamTokenId,
        HEADSTART: headstartTokenId
    });
    
    try {
        // Step 0: Verify governance features are working
        console.log("\n0️⃣ Verifying governance features...");
        
        const adminQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("ADMIN");
        const adminResult = await adminQuery.execute(client);
        const adminAddress = adminResult.getAddress(0);
        
        const governanceQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("GOVERNANCE");
        const governanceResult = await governanceQuery.execute(client);
        const governanceAddress = governanceResult.getAddress(0);
        
        console.log("✅ Governance features verified:");
        console.log("- Admin Address:", adminAddress);
        console.log("- Governance Address:", governanceAddress);
        
        // Step 1: Get required deposit amounts for all 6 tokens
        console.log("\n1️⃣ Getting required deposit amounts...");
        const depositsQuery = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction("calculateRequiredDeposits", new ContractFunctionParameters().addUint256(1));
        
        const depositsResult = await depositsQuery.execute(client);
        const hbarRequired = depositsResult.getUint256(0);
        const wbtcRequired = depositsResult.getUint256(1);
        const sauceRequired = depositsResult.getUint256(2);
        const usdcRequired = depositsResult.getUint256(3);
        const jamRequired = depositsResult.getUint256(4);
        const headstartRequired = depositsResult.getUint256(5);
        
        console.log("Required deposits for 1 LYNX:");
        console.log("- HBAR:", hbarRequired.toString());
        console.log("- WBTC:", wbtcRequired.toString());
        console.log("- SAUCE:", sauceRequired.toString());
        console.log("- USDC:", usdcRequired.toString());
        console.log("- JAM:", jamRequired.toString());
        console.log("- HEADSTART:", headstartRequired.toString());
        
        // Step 2: Check initial balances for all tokens
        console.log("\n2️⃣ Checking initial balances...");
        
        const initialUserLynx = await checkBalanceViaMirror(accountId.toString(), lynxTokenId);
        const initialContractLynx = await checkBalanceViaMirror(contractHederaId, lynxTokenId);
        const initialOperatorLynx = await checkBalanceViaMirror(operatorId, lynxTokenId);
        
        const initialUserWbtc = await checkBalanceViaMirror(accountId.toString(), wbtcTokenId);
        const initialUserSauce = await checkBalanceViaMirror(accountId.toString(), sauceTokenId);
        const initialUserUsdc = await checkBalanceViaMirror(accountId.toString(), usdcTokenId);
        const initialUserJam = await checkBalanceViaMirror(accountId.toString(), jamTokenId);
        const initialUserHeadstart = await checkBalanceViaMirror(accountId.toString(), headstartTokenId);
        
        const initialContractWbtc = await checkBalanceViaMirror(contractHederaId, wbtcTokenId);
        const initialContractSauce = await checkBalanceViaMirror(contractHederaId, sauceTokenId);
        const initialContractUsdc = await checkBalanceViaMirror(contractHederaId, usdcTokenId);
        const initialContractJam = await checkBalanceViaMirror(contractHederaId, jamTokenId);
        const initialContractHeadstart = await checkBalanceViaMirror(contractHederaId, headstartTokenId);
        
        console.log("Initial LYNX token balances:");
        console.log("- User LYNX:", initialUserLynx);
        console.log("- Contract LYNX:", initialContractLynx);
        console.log("- Operator LYNX (Treasury):", initialOperatorLynx);
        
        console.log("Initial user token balances:");
        console.log("- User WBTC:", initialUserWbtc);
        console.log("- User SAUCE:", initialUserSauce);
        console.log("- User USDC:", initialUserUsdc);
        console.log("- User JAM:", initialUserJam);
        console.log("- User HEADSTART:", initialUserHeadstart);
        
        console.log("Initial contract token balances:");
        console.log("- Contract WBTC:", initialContractWbtc);
        console.log("- Contract SAUCE:", initialContractSauce);
        console.log("- Contract USDC:", initialContractUsdc);
        console.log("- Contract JAM:", initialContractJam);
        console.log("- Contract HEADSTART:", initialContractHeadstart);
        
        // Step 3: Check if user has sufficient balances
        console.log("\n3️⃣ Checking if user has sufficient balances...");
        
        const sufficientWbtc = initialUserWbtc >= parseInt(wbtcRequired.toString());
        const sufficientSauce = initialUserSauce >= parseInt(sauceRequired.toString());
        const sufficientUsdc = initialUserUsdc >= parseInt(usdcRequired.toString());
        const sufficientJam = initialUserJam >= parseInt(jamRequired.toString());
        const sufficientHeadstart = initialUserHeadstart >= parseInt(headstartRequired.toString());
        
        console.log("Balance sufficiency check:");
        console.log("- WBTC sufficient:", sufficientWbtc, `(has: ${initialUserWbtc}, needs: ${wbtcRequired.toString()})`);
        console.log("- SAUCE sufficient:", sufficientSauce, `(has: ${initialUserSauce}, needs: ${sauceRequired.toString()})`);
        console.log("- USDC sufficient:", sufficientUsdc, `(has: ${initialUserUsdc}, needs: ${usdcRequired.toString()})`);
        console.log("- JAM sufficient:", sufficientJam, `(has: ${initialUserJam}, needs: ${jamRequired.toString()})`);
        console.log("- HEADSTART sufficient:", sufficientHeadstart, `(has: ${initialUserHeadstart}, needs: ${headstartRequired.toString()})`);
        
        if (!sufficientWbtc || !sufficientSauce || !sufficientUsdc || !sufficientJam || !sufficientHeadstart) {
            console.log("❌ INSUFFICIENT BALANCES - Cannot proceed with test");
            console.log("Please send the required tokens to the test account first");
            return;
        }
        
        // Step 4: Set token allowances for all 5 tokens (HBAR is native, no allowance needed)
        console.log("\n4️⃣ Setting token allowances...");
        
        const wbtcAllowanceTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(wbtcTokenId, accountId, contractId, parseInt(wbtcRequired.toString()))
            .setMaxTransactionFee(new Hbar(5));
        await wbtcAllowanceTx.execute(client);
        console.log("✅ WBTC allowance set");
        
        const sauceAllowanceTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(sauceTokenId, accountId, contractId, parseInt(sauceRequired.toString()))
            .setMaxTransactionFee(new Hbar(5));
        await sauceAllowanceTx.execute(client);
        console.log("✅ SAUCE allowance set");
        
        const usdcAllowanceTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(usdcTokenId, accountId, contractId, parseInt(usdcRequired.toString()))
            .setMaxTransactionFee(new Hbar(5));
        await usdcAllowanceTx.execute(client);
        console.log("✅ USDC allowance set");
        
        const jamAllowanceTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(jamTokenId, accountId, contractId, parseInt(jamRequired.toString()))
            .setMaxTransactionFee(new Hbar(5));
        await jamAllowanceTx.execute(client);
        console.log("✅ JAM allowance set");
        
        const headstartAllowanceTx = new AccountAllowanceApproveTransaction()
            .approveTokenAllowance(headstartTokenId, accountId, contractId, parseInt(headstartRequired.toString()))
            .setMaxTransactionFee(new Hbar(5));
        await headstartAllowanceTx.execute(client);
        console.log("✅ HEADSTART allowance set");
        
        // Step 5: Ensure user is associated with LYNX token
        console.log("\n5️⃣ Ensuring LYNX token association...");
        
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
        
        // Step 6: Execute minting transaction with all 6 tokens
        console.log("\n6️⃣ Executing minting transaction...");
        
        const mintTx = new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(5000000) // Higher gas for 6-token operation
            .setPayableAmount(Hbar.fromTinybars(hbarRequired))
            .setFunction("mintWithDeposits", new ContractFunctionParameters()
                .addUint256(1) // 1 LYNX
                .addUint256(wbtcRequired)
                .addUint256(sauceRequired)
                .addUint256(usdcRequired)
                .addUint256(jamRequired)
                .addUint256(headstartRequired)
            )
            .setMaxTransactionFee(new Hbar(50));
        
        const mintResponse = await mintTx.execute(client);
        const mintReceipt = await mintResponse.getReceipt(client);
        
        if (mintReceipt.status.toString() !== "SUCCESS") {
            throw new Error(`Minting failed with status: ${mintReceipt.status.toString()}`);
        }
        
        console.log("✅ Minting transaction successful!");
        console.log("Transaction ID:", mintResponse.transactionId.toString());
        
        // Step 7: Wait and check final balances
        console.log("\n7️⃣ Waiting 5 seconds then checking final balances...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const finalUserLynx = await checkBalanceViaMirror(accountId.toString(), lynxTokenId);
        const finalContractLynx = await checkBalanceViaMirror(contractHederaId, lynxTokenId);
        const finalOperatorLynx = await checkBalanceViaMirror(operatorId, lynxTokenId);
        
        const finalUserWbtc = await checkBalanceViaMirror(accountId.toString(), wbtcTokenId);
        const finalUserSauce = await checkBalanceViaMirror(accountId.toString(), sauceTokenId);
        const finalUserUsdc = await checkBalanceViaMirror(accountId.toString(), usdcTokenId);
        const finalUserJam = await checkBalanceViaMirror(accountId.toString(), jamTokenId);
        const finalUserHeadstart = await checkBalanceViaMirror(accountId.toString(), headstartTokenId);
        
        const finalContractWbtc = await checkBalanceViaMirror(contractHederaId, wbtcTokenId);
        const finalContractSauce = await checkBalanceViaMirror(contractHederaId, sauceTokenId);
        const finalContractUsdc = await checkBalanceViaMirror(contractHederaId, usdcTokenId);
        const finalContractJam = await checkBalanceViaMirror(contractHederaId, jamTokenId);
        const finalContractHeadstart = await checkBalanceViaMirror(contractHederaId, headstartTokenId);
        
        console.log("Final LYNX balances:");
        console.log("- User LYNX:", finalUserLynx);
        console.log("- Contract LYNX:", finalContractLynx);
        console.log("- Operator LYNX (Treasury):", finalOperatorLynx);
        
        console.log("Final user token balances:");
        console.log("- User WBTC:", finalUserWbtc);
        console.log("- User SAUCE:", finalUserSauce);
        console.log("- User USDC:", finalUserUsdc);
        console.log("- User JAM:", finalUserJam);
        console.log("- User HEADSTART:", finalUserHeadstart);
        
        console.log("Final contract token balances:");
        console.log("- Contract WBTC:", finalContractWbtc);
        console.log("- Contract SAUCE:", finalContractSauce);
        console.log("- Contract USDC:", finalContractUsdc);
        console.log("- Contract JAM:", finalContractJam);
        console.log("- Contract HEADSTART:", finalContractHeadstart);
        
        // Step 8: Analyze what happened with minting and deposits
        console.log("\n8️⃣ Analyzing minting results...");
        
        const lynxMintedToUser = finalUserLynx - initialUserLynx;
        const lynxMintedToContract = finalContractLynx - initialContractLynx;
        const lynxMintedToOperator = finalOperatorLynx - initialOperatorLynx;
        
        const wbtcDeposited = finalContractWbtc - initialContractWbtc;
        const sauceDeposited = finalContractSauce - initialContractSauce;
        const usdcDeposited = finalContractUsdc - initialContractUsdc;
        const jamDeposited = finalContractJam - initialContractJam;
        const headstartDeposited = finalContractHeadstart - initialContractHeadstart;
        
        const wbtcSpent = initialUserWbtc - finalUserWbtc;
        const sauceSpent = initialUserSauce - finalUserSauce;
        const usdcSpent = initialUserUsdc - finalUserUsdc;
        const jamSpent = initialUserJam - finalUserJam;
        const headstartSpent = initialUserHeadstart - finalUserHeadstart;
        
        console.log("LYNX Token Changes:");
        console.log("- LYNX to User:", lynxMintedToUser);
        console.log("- LYNX to Contract:", lynxMintedToContract);
        console.log("- LYNX to Operator (Treasury):", lynxMintedToOperator);
        console.log("- Total LYNX minted:", lynxMintedToUser + lynxMintedToContract + lynxMintedToOperator);
        
        console.log("\nDeposit Changes (to contract):");
        console.log("- WBTC deposited:", wbtcDeposited);
        console.log("- SAUCE deposited:", sauceDeposited);
        console.log("- USDC deposited:", usdcDeposited);
        console.log("- JAM deposited:", jamDeposited);
        console.log("- HEADSTART deposited:", headstartDeposited);
        
        console.log("\nUser Token Changes (spent):");
        console.log("- WBTC spent:", wbtcSpent);
        console.log("- SAUCE spent:", sauceSpent);
        console.log("- USDC spent:", usdcSpent);
        console.log("- JAM spent:", jamSpent);
        console.log("- HEADSTART spent:", headstartSpent);
        
        // Step 9: Determine what actually happened
        console.log("\n9️⃣ Diagnosis...");
        
        const expectedLynxMinted = 100000000; // 1 LYNX with 8 decimals
        const expectedWbtcDeposited = parseInt(wbtcRequired.toString());
        const expectedSauceDeposited = parseInt(sauceRequired.toString());
        const expectedUsdcDeposited = parseInt(usdcRequired.toString());
        const expectedJamDeposited = parseInt(jamRequired.toString());
        const expectedHeadstartDeposited = parseInt(headstartRequired.toString());
        
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
                console.log("   Contract should transfer from operator to user");
            } else if (lynxMintedToContract === expectedLynxMinted) {
                console.log("❌ Tokens went to CONTRACT - this shouldn't happen");
            } else {
                console.log("❌ Tokens were split between accounts - unexpected behavior");
            }
        } else {
            console.log(`❌ WRONG AMOUNT MINTED - Expected ${expectedLynxMinted}, got ${totalLynxMinted}`);
        }
        
        // Check deposits
        const depositsCorrect = (
            wbtcDeposited === expectedWbtcDeposited &&
            sauceDeposited === expectedSauceDeposited &&
            usdcDeposited === expectedUsdcDeposited &&
            jamDeposited === expectedJamDeposited &&
            headstartDeposited === expectedHeadstartDeposited
        );
        
        if (depositsCorrect) {
            console.log("✅ All deposits were taken correctly");
        } else {
            console.log("❌ Some deposits were not taken correctly:");
            console.log(`   WBTC: expected ${expectedWbtcDeposited}, got ${wbtcDeposited}`);
            console.log(`   SAUCE: expected ${expectedSauceDeposited}, got ${sauceDeposited}`);
            console.log(`   USDC: expected ${expectedUsdcDeposited}, got ${usdcDeposited}`);
            console.log(`   JAM: expected ${expectedJamDeposited}, got ${jamDeposited}`);
            console.log(`   HEADSTART: expected ${expectedHeadstartDeposited}, got ${headstartDeposited}`);
        }
        
        // Final verdict
        console.log("\n🎯 CONCLUSION:");
        if (totalLynxMinted === 0) {
            console.log("The contract's mintToken() call is failing. Check contract supply key permissions.");
        } else if (lynxMintedToUser === expectedLynxMinted && depositsCorrect) {
            console.log("🎉 EVERYTHING IS WORKING PERFECTLY! 6-token minting system is operational!");
        } else if (lynxMintedToOperator > 0) {
            console.log("Minting works, but tokens go to treasury. Contract transfer logic needs investigation.");
        } else if (!depositsCorrect) {
            console.log("Minting works but deposit logic has issues. Check token transfer functions.");
        } else {
            console.log("Unexpected behavior detected. Need to investigate further.");
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

testDepositMinterV2Operations().catch(console.error); 