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
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env.local" });

async function main() {
  console.log("🚀 Deploying SimpleTokenMinter for testing...");

  // Setup client with operator account
  const operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  console.log("Operator account:", operatorId.toString());
  console.log("Operator EVM address:", operatorId.toSolidityAddress());

  try {
    // Step 1: Get contract bytecode
    console.log("\n📦 Getting SimpleTokenMinter bytecode...");
    
    const artifactPath = "./artifacts/contracts/debug/SimpleTokenMinter.sol/SimpleTokenMinter.json";
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const bytecode = artifact.bytecode;
    
    if (!bytecode) {
      throw new Error("Failed to get contract bytecode");
    }
    
    console.log("✅ Contract compiled successfully");
    
    // Step 2: Create bytecode file
    console.log("\n📁 Creating bytecode file...");
    
    const fileCreateTx = new FileCreateTransaction()
      .setKeys([operatorKey.publicKey])
      .setContents("")
      .setMaxTransactionFee(new Hbar(2));
    
    const fileSubmit = await fileCreateTx.execute(client);
    const fileReceipt = await fileSubmit.getReceipt(client);
    const bytecodeFileId = fileReceipt.fileId;
    
    console.log("✅ Empty bytecode file created:", bytecodeFileId!.toString());
    
    // Append bytecode to the file
    const fileAppendTx = new FileAppendTransaction()
      .setFileId(bytecodeFileId!)
      .setContents(bytecode)
      .setMaxTransactionFee(new Hbar(2));
    
    await fileAppendTx.execute(client);
    console.log("✅ Bytecode appended successfully");

    // Step 3: Deploy contract (no constructor parameters needed)
    console.log("\n🏗️ Deploying SimpleTokenMinter...");
    
    const deployTransaction = new ContractCreateTransaction()
      .setGas(1000000) // Lower gas for simple contract
      .setBytecodeFileId(bytecodeFileId!)
      .setMaxTransactionFee(new Hbar(20));

    const txResponse = await deployTransaction.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const newContractId = receipt.contractId;

    if (!newContractId) {
      throw new Error("Failed to get contract ID from receipt");
    }

    const contractAddress = `0x${newContractId.toSolidityAddress()}`;
    
    console.log("✅ SimpleTokenMinter deployed successfully!");
    console.log("Contract ID:", newContractId.toString());
    console.log("Contract Address:", contractAddress);

    // Step 4: Set the LYNX test token address
    console.log("\n🔗 Setting LYNX test token address...");
    
    const lynxTestTokenAddress = process.env.NEXT_PUBLIC_LYNX_TEST_TOKEN_EVM_ID!;
    console.log("LYNX Test Token EVM Address:", lynxTestTokenAddress);
    
    const setTokenTx = new ContractExecuteTransaction()
      .setContractId(newContractId)
      .setGas(300000)
      .setFunction("setTokenAddress", new ContractFunctionParameters()
        .addAddress(lynxTestTokenAddress)
      )
      .setMaxTransactionFee(new Hbar(10));

    const setTokenResponse = await setTokenTx.execute(client);
    const setTokenReceipt = await setTokenResponse.getReceipt(client);

    console.log("✅ Test token address set!");
    console.log("Set token status:", setTokenReceipt.status.toString());

    // Step 5: Verify token address was set
    console.log("\n🔍 Verifying test token address...");
    
    const tokenQuery = new ContractCallQuery()
      .setContractId(newContractId)
      .setGas(100000)
      .setFunction("tokenAddress");

    const tokenResult = await tokenQuery.execute(client);
    const setTokenAddress = tokenResult.getAddress(0);

    console.log("Contract token address:", setTokenAddress);
    console.log("Expected test token address:", lynxTestTokenAddress);
    console.log("Addresses match:", setTokenAddress.toLowerCase() === lynxTestTokenAddress.toLowerCase());

    // Step 6: Associate contract with the token
    console.log("\n🔗 Associating contract with test token...");
    
    const associateTokensTx = new ContractExecuteTransaction()
      .setContractId(newContractId)
      .setGas(1000000) // High gas for HTS operations
      .setFunction("associateTokens")
      .setMaxTransactionFee(new Hbar(20));

    const associateResponse = await associateTokensTx.execute(client);
    const associateReceipt = await associateResponse.getReceipt(client);

    console.log("✅ Token association completed!");
    console.log("Association status:", associateReceipt.status.toString());

    // Step 7: Wait and verify association via mirror node (following DepositMinter pattern)
    console.log("\n🔍 Waiting 3 seconds before checking association...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("Checking token association via mirror node...");
    const contractHederaId = newContractId.toString();
    const lynxTestTokenId = process.env.NEXT_PUBLIC_LYNX_TEST_TOKEN_ID!;
    
    // Check association using mirror node API (external verification)
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

    const isAssociated = await checkTokenAssociation(contractHederaId, lynxTestTokenId);

    console.log("Association status (via mirror node):");
    console.log("- LYNX Test Token associated:", isAssociated);

    if (!isAssociated) {
      console.log("⚠️ Token not associated - may need more time or manual check");
    } else {
      console.log("✅ Token association verified!");
    }

    // Step 8: Save deployment info
    const deploymentInfo = {
      contractId: newContractId.toString(),
      contractAddress: contractAddress,
      tokenAddress: setTokenAddress,
      operatorId: operatorId.toString(),
      operatorEVMAddress: operatorId.toSolidityAddress(),
      isAssociated: isAssociated,
      deployedAt: new Date().toISOString(),
      purpose: "SimpleTokenMinter for testing minting functionality with token association"
    };

    fs.writeFileSync(
      "simple-minter-info.json",
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n🎉 DEPLOYMENT COMPLETE!");
    console.log("✅ SimpleTokenMinter deployed and configured");
    console.log("✅ LYNX test token address set");
    console.log("✅ Ready for minting tests");
    console.log("✅ Deployment info saved to simple-minter-info.json");
    
    console.log("\nNext steps:");
    console.log("1. Transfer supply key to this contract");
    console.log("2. Test minting functionality");

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