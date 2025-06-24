import * as fs from "fs";
import { 
    Client, 
    AccountId, 
    PrivateKey, 
    ContractCreateTransaction, 
    ContractFunctionParameters,
    ContractCallQuery,
    ContractExecuteTransaction,
    FileCreateTransaction,
    FileAppendTransaction,
    Hbar
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../.env.local" });

async function main() {
    console.log("🚀 Deploying DepositMinterV2 with Governance Features");
    console.log("====================================================");

    // Setup client with operator account
    const operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
    const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
    const client = Client.forTestnet().setOperator(operatorId, operatorKey);

    console.log("Operator account:", operatorId.toString());
    console.log("Operator EVM address:", operatorId.toSolidityAddress());

    try {
        // Step 1: Get token addresses from environment
        const lynxTokenId = process.env.NEXT_PUBLIC_LYNX_TOKEN_ID!;
        const sauceTokenId = process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID!;
        const wbtcTokenId = process.env.NEXT_PUBLIC_WBTC_TOKEN_ID!;
        const usdcTokenId = process.env.NEXT_PUBLIC_USDC_TOKEN_ID!;
        const jamTokenId = process.env.NEXT_PUBLIC_JAM_TOKEN_ID!;
        const headstartTokenId = process.env.NEXT_PUBLIC_HEADSTART_TOKEN_ID!;
    
        const lynxTokenAddress = process.env.NEXT_PUBLIC_LYNX_TOKEN_EVM_ID!;
        const sauceTokenAddress = process.env.NEXT_PUBLIC_SAUCE_TOKEN_EVM_ID!;
        const wbtcTokenAddress = process.env.NEXT_PUBLIC_WBTC_TOKEN_EVM_ID!;
        const usdcTokenAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_EVM_ID!;
        const jamTokenAddress = process.env.NEXT_PUBLIC_JAM_TOKEN_EVM_ID!;
        const headstartTokenAddress = process.env.NEXT_PUBLIC_HEADSTART_TOKEN_EVM_ID!;
        
        // Step 2: Get bytecode from compiled artifacts
        console.log("\n📦 Getting contract bytecode...");
        
        const artifactPath = "./artifacts/contracts/DepositMinterV2.sol/DepositMinterV2.json";
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        const bytecode = artifact.bytecode;
        
        if (!bytecode) {
            throw new Error("Failed to get contract bytecode");
        }
        
        console.log("✅ Contract compiled successfully");
        console.log(`Bytecode size: ${bytecode.length / 2 - 1} bytes`);
        
        // Step 3: Create bytecode file using proper file-based deployment pattern
        console.log("\n📁 Creating bytecode file...");
        
        // Create empty file first
        const fileCreateTx = new FileCreateTransaction()
            .setKeys([operatorKey.publicKey])
            .setContents("")
            .setMaxTransactionFee(new Hbar(2));
        
        const fileSubmit = await fileCreateTx.execute(client);
        const fileReceipt = await fileSubmit.getReceipt(client);
        const bytecodeFileId = fileReceipt.fileId;
        
        console.log("✅ Empty bytecode file created:", bytecodeFileId!.toString());
        
        // Append full bytecode to the file
        console.log("📝 Appending bytecode to file...");
        const fileAppendTx = new FileAppendTransaction()
            .setFileId(bytecodeFileId!)
            .setContents(bytecode)
            .setMaxTransactionFee(new Hbar(2));
        
        await fileAppendTx.execute(client);
        console.log("✅ Bytecode appended successfully");

        // Step 4: Display token addresses
        console.log("\nToken IDs:");
        console.log("- LYNX:", lynxTokenId);
        console.log("- SAUCE:", sauceTokenId);
        console.log("- WBTC:", wbtcTokenId);
        console.log("- USDC:", usdcTokenId);
        console.log("- JAM:", jamTokenId);
        console.log("- HEADSTART:", headstartTokenId);
        
        console.log("\nToken EVM addresses:");
        console.log("- LYNX:", lynxTokenAddress);
        console.log("- SAUCE:", sauceTokenAddress);
        console.log("- WBTC:", wbtcTokenAddress);
        console.log("- USDC:", usdcTokenAddress);
        console.log("- JAM:", jamTokenAddress);
        console.log("- HEADSTART:", headstartTokenAddress);
        
        console.log("\nTreasury address (operator EVM address):");
        console.log("- Treasury:", operatorId.toSolidityAddress());

        // Step 5: Deploy contract
        console.log("\n🏗️ Deploying DepositMinterV2 with governance features...");
        
        const deployTransaction = new ContractCreateTransaction()
            .setGas(4000000) // Higher gas for governance features
            .setBytecodeFileId(bytecodeFileId!)
            .setConstructorParameters(
                new ContractFunctionParameters()
                    .addAddress(lynxTokenAddress)      // LYNX token EVM address
                    .addAddress(wbtcTokenAddress)      // WBTC token EVM address
                    .addAddress(sauceTokenAddress)     // SAUCE token EVM address
                    .addAddress(usdcTokenAddress)      // USDC token EVM address
                    .addAddress(jamTokenAddress)       // JAM token EVM address
                    .addAddress(headstartTokenAddress) // HEADSTART token EVM address
                    .addAddress(operatorId.toSolidityAddress()) // Treasury address (operator)
            )
            .setMaxTransactionFee(new Hbar(50));

        const txResponse = await deployTransaction.execute(client);
        const receipt = await txResponse.getReceipt(client);
        const newContractId = receipt.contractId;

        if (!newContractId) {
            throw new Error("Failed to get contract ID from receipt");
        }

        const contractAddress = `0x${newContractId.toSolidityAddress()}`;
        
        console.log("✅ Contract deployed successfully!");
        console.log("Contract ID:", newContractId.toString());
        console.log("Contract Address:", contractAddress);

        // Step 6: Verify governance features
        console.log("\n🔍 Verifying governance features...");
        
        // Wait for deployment to settle
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check admin
        const adminQuery = new ContractCallQuery()
            .setContractId(newContractId)
            .setGas(100000)
            .setFunction("ADMIN");

        const adminResult = await adminQuery.execute(client);
        const adminAddress = adminResult.getAddress(0);
        
        // Check governance (should be zero initially)
        const governanceQuery = new ContractCallQuery()
            .setContractId(newContractId)
            .setGas(100000)
            .setFunction("GOVERNANCE");

        const governanceResult = await governanceQuery.execute(client);
        const governanceAddress = governanceResult.getAddress(0);
        
        // Check initial ratios
        const ratiosQuery = new ContractCallQuery()
            .setContractId(newContractId)
            .setGas(100000)
            .setFunction("getCurrentRatios");

        const ratiosResult = await ratiosQuery.execute(client);
        const hbarRatio = ratiosResult.getUint256(0);
        const wbtcRatio = ratiosResult.getUint256(1);
        const sauceRatio = ratiosResult.getUint256(2);
        const usdcRatio = ratiosResult.getUint256(3);
        const jamRatio = ratiosResult.getUint256(4);
        const headstartRatio = ratiosResult.getUint256(5);

        console.log("✅ Governance features verified!");
        console.log("Admin Address:", adminAddress);
        console.log("Governance Address:", governanceAddress);
        console.log("Initial Ratios:");
        console.log("- HBAR:", hbarRatio.toString());
        console.log("- WBTC:", wbtcRatio.toString());
        console.log("- SAUCE:", sauceRatio.toString());
        console.log("- USDC:", usdcRatio.toString());
        console.log("- JAM:", jamRatio.toString());
        console.log("- HEADSTART:", headstartRatio.toString());

        // Step 7: Associate contract with tokens
        console.log("\n🔗 Associating contract with tokens...");
        
        const associateTokensTx = new ContractExecuteTransaction()
            .setContractId(newContractId)
            .setGas(5000000) // High gas limit for HTS operations
            .setFunction("associateTokens")
            .setMaxTransactionFee(new Hbar(50));

        const associateResponse = await associateTokensTx.execute(client);
        const associateReceipt = await associateResponse.getReceipt(client);

        console.log("✅ Token association completed!");
        console.log("Association status:", associateReceipt.status.toString());

        // Step 8: Verify associations
        console.log("\n🔍 Verifying token associations...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const contractHederaId = newContractId.toString();
        
        // Check associations using mirror node API
        const checkTokenAssociation = async (accountId: string, tokenId: string) => {
            try {
                const response = await fetch(
                    `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`
                );
                const data = await response.json();
                return data.tokens && data.tokens.length > 0;
            } catch (error) {
                console.error(`Error checking ${tokenId} association:`, error);
                return false;
            }
        };

        const lynxAssociated = await checkTokenAssociation(contractHederaId, lynxTokenId);
        const sauceAssociated = await checkTokenAssociation(contractHederaId, sauceTokenId);
        const wbtcAssociated = await checkTokenAssociation(contractHederaId, wbtcTokenId);
        const usdcAssociated = await checkTokenAssociation(contractHederaId, usdcTokenId);
        const jamAssociated = await checkTokenAssociation(contractHederaId, jamTokenId);
        const headstartAssociated = await checkTokenAssociation(contractHederaId, headstartTokenId);

        console.log("Token associations:");
        console.log("- LYNX:", lynxAssociated ? "✅" : "❌");
        console.log("- SAUCE:", sauceAssociated ? "✅" : "❌");
        console.log("- WBTC:", wbtcAssociated ? "✅" : "❌");
        console.log("- USDC:", usdcAssociated ? "✅" : "❌");
        console.log("- JAM:", jamAssociated ? "✅" : "❌");
        console.log("- HEADSTART:", headstartAssociated ? "✅" : "❌");

        // Step 9: Save deployment info
        console.log("\n💾 Saving deployment information...");
        
        const deploymentInfo = {
            contractId: newContractId.toString(),
            contractAddress: contractAddress,
            adminAddress: adminAddress,
            governanceAddress: governanceAddress,
            operatorId: operatorId.toString(),
            operatorEVMAddress: operatorId.toSolidityAddress(),
            isAdminVerified: adminAddress.toLowerCase() === operatorId.toSolidityAddress().toLowerCase(),
            lynxToken: lynxTokenAddress,
            sauceToken: sauceTokenAddress,
            wbtcToken: wbtcTokenAddress,
            usdcToken: usdcTokenAddress,
            jamToken: jamTokenAddress,
            headstartToken: headstartTokenAddress,
            associationsVerified: {
                lynx: lynxAssociated,
                sauce: sauceAssociated,
                wbtc: wbtcAssociated,
                usdc: usdcAssociated,
                jam: jamAssociated,
                headstart: headstartAssociated
            },
            initialRatios: {
                hbar: hbarRatio.toString(),
                wbtc: wbtcRatio.toString(),
                sauce: sauceRatio.toString(),
                usdc: usdcRatio.toString(),
                jam: jamRatio.toString(),
                headstart: headstartRatio.toString()
            },
            hasGovernance: true,
            deployedAt: new Date().toISOString()
        };
        
        const infoPath = "./deposit-minter-v2-governance-info.json";
        fs.writeFileSync(infoPath, JSON.stringify(deploymentInfo, null, 2));
        
        console.log("✅ Deployment info saved to:", infoPath);

        // Final summary
        console.log("\n🎉 DEPLOYMENT COMPLETE!");
        console.log("======================");
        console.log("Contract ID:", newContractId.toString());
        console.log("Contract EVM Address:", contractAddress);
        console.log("Admin Address:", adminAddress);
        console.log("Governance Address:", governanceAddress);
        console.log("Has Governance Features: ✅");
        
        console.log("\n📋 Next Steps:");
        console.log("1. Update test scripts to use new contract ID:", newContractId.toString());
        console.log("2. Set governance address: contract.setGovernanceAddress(governanceAddress)");
        console.log("3. Run ratio adjustment tests: npx ts-node scripts/test-ratio-adjustment.ts");
        console.log("4. Test governance ratio updates");

    } catch (error: any) {
        console.error("❌ Deployment failed:", error.message);
        throw error;
    } finally {
        client.close();
    }
}

main().catch(console.error); 