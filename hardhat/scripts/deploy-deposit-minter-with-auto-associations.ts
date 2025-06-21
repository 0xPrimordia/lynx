import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as hre from "hardhat";
import { ethers } from "hardhat";
import * as fs from "fs";
import { 
  Client, 
  AccountId, 
  PrivateKey, 
  ContractCreateTransaction, 
  FileCreateTransaction, 
  FileDeleteTransaction,
  FileId,
  Hbar,
  ContractId
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env.local" });

async function main() {
  console.log("🚀 Deploying DepositMinter contract with auto-association support...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Setup Hedera client for proper auto-association
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  if (!operatorId || !operatorKey) {
    throw new Error("Missing Hedera operator credentials");
  }

  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );

  console.log("✅ Hedera client configured");

  // Get contract bytecode
  const DepositMinter = await hre.ethers.getContractFactory("DepositMinter");
  const bytecode = DepositMinter.bytecode;
  
  console.log("📁 Creating file to store contract bytecode...");
  
  // Create file to store bytecode
  const fileCreateTx = new FileCreateTransaction()
    .setContents(bytecode)
    .setKeys([PrivateKey.fromString(operatorKey).publicKey])
    .setMaxTransactionFee(new Hbar(2));

  const fileCreateSubmit = await fileCreateTx.execute(client);
  const fileCreateReceipt = await fileCreateSubmit.getReceipt(client);
  const bytecodeFileId = fileCreateReceipt.fileId;
  
  console.log("✅ Bytecode file created:", bytecodeFileId?.toString());

  // Deploy contract with max auto associations set to 2 (for SAUCE and CLXY)
  console.log("🏗️ Deploying contract with maxAutoAssociations = 2...");
  
  const contractCreateTx = new ContractCreateTransaction()
    .setBytecodeFileId(bytecodeFileId!)
    .setGas(2000000)
    .setMaxAutomaticTokenAssociations(2) // ✨ This is the key setting for auto-association!
    .setInitialBalance(new Hbar(0))
    .setMaxTransactionFee(new Hbar(20));

  const contractCreateSubmit = await contractCreateTx.execute(client);
  const contractCreateReceipt = await contractCreateSubmit.getReceipt(client);
  const contractId = contractCreateReceipt.contractId;
  
  console.log("✅ DepositMinter deployed with auto-association support!");
  console.log("Contract ID:", contractId?.toString());
  console.log("Max Auto Associations: 2 (SAUCE + CLXY)");

  // Clean up bytecode file
  console.log("🧹 Cleaning up bytecode file...");
  const fileDeleteTx = new FileDeleteTransaction()
    .setFileId(bytecodeFileId!)
    .setMaxTransactionFee(new Hbar(2));
  
  await fileDeleteTx.execute(client);
  console.log("✅ Bytecode file cleaned up");

  // Convert contract ID to EVM address
  const contractAddress = contractId?.toSolidityAddress();
  console.log("EVM Address:", `0x${contractAddress}`);

  // Get contract instance for configuration
  const contractEvmAddress = `0x${contractAddress}`;
  const depositMinter = DepositMinter.attach(contractEvmAddress);

  // Configure token addresses
  console.log("\n⚙️ Configuring token addresses...");
  
  const lynxTokenAddress = process.env.NEXT_PUBLIC_LYNX_TOKEN_EVM_ID!;
  const sauceTokenAddress = process.env.NEXT_PUBLIC_SAUCE_TOKEN_EVM_ID!;
  const clxyTokenAddress = process.env.NEXT_PUBLIC_CLXY_TOKEN_EVM_ID!;
  
  console.log("Token addresses:");
  console.log("- LYNX:", lynxTokenAddress);
  console.log("- SAUCE:", sauceTokenAddress);
  console.log("- CLXY:", clxyTokenAddress);

  // Set token addresses
  console.log("Setting LYNX token...");
  const setLynxTx = await depositMinter.setLynxToken(lynxTokenAddress, {
    gasLimit: 400000,
    gasPrice: hre.ethers.parseUnits("620", "gwei"),
  });
  await setLynxTx.wait();
  console.log("✅ LYNX token set");

  console.log("Setting SAUCE token...");
  const setSauceTx = await depositMinter.setSauceToken(sauceTokenAddress, {
    gasLimit: 400000,
    gasPrice: hre.ethers.parseUnits("620", "gwei"),
  });
  await setSauceTx.wait();
  console.log("✅ SAUCE token set");

  console.log("Setting CLXY token...");
  const setClxyTx = await depositMinter.setClxyToken(clxyTokenAddress, {
    gasLimit: 400000,
    gasPrice: hre.ethers.parseUnits("620", "gwei"),
  });
  await setClxyTx.wait();
  console.log("✅ CLXY token set");

  // Test auto-association capability
  console.log("\n🧪 Testing auto-association capability...");
  
  try {
    const [sauceAssociated, clxyAssociated, lynxAssociated] = await depositMinter.checkAllAssociations();
    console.log("Association status:");
    console.log("- SAUCE:", sauceAssociated ? "✅ Associated" : "❌ Not associated");
    console.log("- CLXY:", clxyAssociated ? "✅ Associated" : "❌ Not associated");
    console.log("- LYNX:", lynxAssociated ? "✅ Associated" : "❌ Not associated");
  } catch (error) {
    console.log("⚠️ Association check failed - tokens will auto-associate on first transfer");
  }

  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractEvmAddress,
    hederaId: contractId?.toString(),
    admin: deployer.address,
    lynxToken: lynxTokenAddress,
    sauceToken: sauceTokenAddress,
    clxyToken: clxyTokenAddress,
    maxAutoAssociations: 2,
    autoAssociationEnabled: true,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    "deposit-minter-auto-association-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n🎉 DEPLOYMENT COMPLETE WITH AUTO-ASSOCIATION!");
  console.log("✅ Contract deployed with maxAutoAssociations = 2");
  console.log("✅ SAUCE and CLXY tokens will auto-associate on transfer");
  console.log("✅ No manual association required for these tokens");
  console.log("✅ Deployment info saved to deposit-minter-auto-association-info.json");
  
  console.log("\nContract Details:");
  console.log("- EVM Address:", contractEvmAddress);
  console.log("- Hedera ID:", contractId?.toString());
  console.log("- Admin:", deployer.address);
  console.log("- Max Auto Associations: 2 (SAUCE + CLXY)");

  client.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 