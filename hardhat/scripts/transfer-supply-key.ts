import { Client, AccountId, PrivateKey, TokenUpdateTransaction, ContractId, Hbar } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env.local" });

async function main() {
  console.log("🔄 Transferring LYNX token supply key to DepositMinterV2 contract...");
  
  // Token and contract info - using main LYNX token and DepositMinterV2 V3 (with governance)
  const lynxTokenId = process.env.NEXT_PUBLIC_LYNX_TOKEN_ID || "0.0.6200902"; // Main LYNX token ID
  const depositMinterHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_V3_ID || "0.0.6216949"; // DepositMinterV2 V3 with governance
  
  if (!lynxTokenId) {
    throw new Error("NEXT_PUBLIC_LYNX_TOKEN_ID environment variable not set");
  }
  
  if (!depositMinterHederaId) {
    throw new Error("NEXT_PUBLIC_DEPOSIT_MINTER_V3_ID environment variable not set");
  }
  
  console.log(`LYNX Token ID: ${lynxTokenId}`);
  console.log(`DepositMinterV2 V3 Contract ID: ${depositMinterHederaId}`);
  
  // Setup Hedera credentials
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
  const operatorKey = process.env.OPERATOR_KEY || "";

  if (!operatorId || !operatorKey) {
    throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
  }

  try {
    // Initialize Hedera client
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );

    console.log(`\n🔑 Updating supply key for LYNX token ${lynxTokenId}...`);
    console.log(`New supply key will be DepositMinterV2 V3 contract: ${depositMinterHederaId}`);

    // Create token update transaction to change supply key
    const tokenUpdateTx = new TokenUpdateTransaction()
      .setTokenId(lynxTokenId)
      .setSupplyKey(ContractId.fromString(depositMinterHederaId))
      .setMaxTransactionFee(new Hbar(5))
      .freezeWith(client);

    // Execute the transaction
    console.log("\n📝 Executing token update transaction...");
    const tokenUpdateSubmit = await tokenUpdateTx.execute(client);
    const tokenUpdateRx = await tokenUpdateSubmit.getReceipt(client);

    console.log("✅ Supply key transfer completed!");
    console.log(`Transaction ID: ${tokenUpdateSubmit.transactionId?.toString()}`);
    console.log(`Status: ${tokenUpdateRx.status.toString()}`);

    console.log("\n🎉 SUCCESS!");
    console.log(`The LYNX token ${lynxTokenId} supply key has been transferred to the DepositMinterV2 V3 contract.`);
    console.log(`The DepositMinterV2 V3 contract can now mint LYNX tokens.`);

    client.close();

  } catch (error) {
    console.error("❌ Error transferring supply key:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 