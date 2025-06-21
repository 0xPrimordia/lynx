// No imports needed for this approach
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
dotenv.config({ path: "../.env.local" });

async function main() {
  console.log("🚀 Deploying DepositMinter with proper admin pattern...");

  // Setup client with operator account
  const operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  console.log("Operator account:", operatorId.toString());
  console.log("Operator EVM address:", operatorId.toSolidityAddress());

  try {
        // Step 1: Get contract factory and bytecode
    console.log("\n📦 Getting contract factory...");
    
    // Step 2: Get raw bytecode without constructor parameters  
    const lynxTokenId = process.env.NEXT_PUBLIC_LYNX_TOKEN_ID!;
    const sauceTokenId = process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID!;
    const clxyTokenId = process.env.NEXT_PUBLIC_CLXY_TOKEN_ID!;
  
  const lynxTokenAddress = process.env.NEXT_PUBLIC_LYNX_TOKEN_EVM_ID!;
  const sauceTokenAddress = process.env.NEXT_PUBLIC_SAUCE_TOKEN_EVM_ID!;
  const clxyTokenAddress = process.env.NEXT_PUBLIC_CLXY_TOKEN_EVM_ID!;
  
    // Get bytecode from compiled artifacts
    const artifactPath = "./artifacts/contracts/DepositMinter.sol/DepositMinter.json";
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const bytecode = artifact.bytecode;
    
    if (!bytecode) {
      throw new Error("Failed to get contract bytecode");
    }
    
    console.log("✅ Contract compiled successfully");
    
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
    console.log("\nToken IDs (for constructor):");
    console.log("- LYNX:", lynxTokenId);
    console.log("- SAUCE:", sauceTokenId);
    console.log("- CLXY:", clxyTokenId);
    
    console.log("\nToken EVM addresses (for reference):");
    console.log("- LYNX:", lynxTokenAddress);
    console.log("- SAUCE:", sauceTokenAddress);
    console.log("- CLXY:", clxyTokenAddress);
    
    console.log("\nTreasury address (operator EVM address):");
    console.log("- Treasury:", operatorId.toSolidityAddress());

    // Step 5: Deploy contract using file-based deployment pattern
    console.log("\n🏗️ Deploying contract with admin pattern...");
    
    const deployTransaction = new ContractCreateTransaction()
      .setGas(3000000) // Increased gas for contract with HTS interface
      .setBytecodeFileId(bytecodeFileId!) // Use file, not direct bytecode
      .setConstructorParameters(
        new ContractFunctionParameters()
          .addAddress(lynxTokenAddress) // LYNX token EVM address
          .addAddress(sauceTokenAddress) // SAUCE token EVM address
          .addAddress(clxyTokenAddress) // CLXY token EVM address
          .addAddress(operatorId.toSolidityAddress()) // Treasury address (operator)
      )
      .setMaxTransactionFee(new Hbar(20));

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

    // Step 6: Verify admin after deployment
    console.log("\n🔍 Verifying admin setup...");
    
    const adminQuery = new ContractCallQuery()
      .setContractId(newContractId)
      .setGas(100000)
      .setFunction("ADMIN");

    const adminResult = await adminQuery.execute(client);
    const adminAddress = adminResult.getAddress(0);
    const operatorEVMAddress = operatorId.toSolidityAddress();
    const isAdmin = adminAddress.toLowerCase() === operatorEVMAddress.toLowerCase();

    console.log("Contract admin address:", adminAddress);
    console.log("Operator EVM address:", operatorEVMAddress);
    console.log("Is operator admin?", isAdmin);

    if (!isAdmin) {
      throw new Error("Admin verification failed - operator is not admin");
    }

    console.log("✅ Admin verification successful");

    // Step 7: Associate contract with tokens using high gas
    console.log("\n🔗 Associating contract with tokens...");
    
    // Call the contract's associateTokens function with high gas
    const associateTokensTx = new ContractExecuteTransaction()
      .setContractId(newContractId)
      .setGas(5000000) // High gas limit is critical for HTS operations
      .setFunction("associateTokens")
      .setMaxTransactionFee(new Hbar(50));

    const associateResponse = await associateTokensTx.execute(client);
    const associateReceipt = await associateResponse.getReceipt(client);

    console.log("✅ Token association completed!");
    console.log("Association status:", associateReceipt.status.toString());

    // Step 8: Wait and verify associations externally (recommended approach)
    console.log("\n🔍 Waiting 3 seconds before checking associations...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("Checking token associations via mirror node...");
    const contractHederaId = newContractId.toString();
    
    // Check associations using mirror node API (external verification)
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
    const clxyAssociated = await checkTokenAssociation(contractHederaId, clxyTokenId);

    console.log("Association status (via mirror node):");
    console.log("- LYNX associated:", lynxAssociated);
    console.log("- SAUCE associated:", sauceAssociated);
    console.log("- CLXY associated:", clxyAssociated);

    if (!lynxAssociated || !sauceAssociated || !clxyAssociated) {
      console.log("⚠️ Some tokens not associated - may need more time or manual check");
    } else {
      console.log("✅ All tokens properly associated");
    }

    // Step 9: Test calculation function
    console.log("\n🧮 Testing calculation function...");
    
    const calcQuery = new ContractCallQuery()
      .setContractId(newContractId)
      .setGas(100000)
      .setFunction("calculateRequiredDeposits", new ContractFunctionParameters().addUint256(1));

    const calcResult = await calcQuery.execute(client);
    const sauceRequired = calcResult.getUint256(0);
    const clxyRequired = calcResult.getUint256(1);
    const hbarRequired = calcResult.getUint256(2);

    console.log("Required deposits for 1 LYNX:");
    console.log("- SAUCE:", sauceRequired.toString());
    console.log("- CLXY:", clxyRequired.toString());
    console.log("- HBAR:", hbarRequired.toString());

    // Step 10: Save deployment info
    const deploymentInfo = {
      contractId: newContractId.toString(),
      contractAddress: contractAddress,
      adminAddress: adminAddress,
      operatorId: operatorId.toString(),
      operatorEVMAddress: operatorEVMAddress,
      isAdminVerified: isAdmin,
      lynxToken: lynxTokenAddress,
      sauceToken: sauceTokenAddress,
      clxyToken: clxyTokenAddress,
      associationsVerified: {
        lynx: lynxAssociated,
        sauce: sauceAssociated,
        clxy: clxyAssociated
      },
      deployedAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      "deposit-minter-info.json",
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n🎉 DEPLOYMENT COMPLETE!");
    console.log("✅ Contract deployed with proper admin setup");
    console.log("✅ Token associations completed");
    console.log("✅ Admin verification successful");
    console.log("✅ Deployment info saved to deposit-minter-info.json");
    
    console.log("\nContract Details:");
    console.log("- Contract ID:", newContractId.toString());
    console.log("- Contract Address:", contractAddress);
    console.log("- Admin Address:", adminAddress);
    console.log("- Ready for token operations with high gas limits");

  } catch (error: any) {
    console.error("❌ Deployment failed:", error);
    if (error.status) {
      console.error("Hedera Status:", error.status.toString());
    }
    throw error;
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