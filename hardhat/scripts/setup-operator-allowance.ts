import { Client, AccountId, PrivateKey, AccountAllowanceApproveTransaction, TokenId, Hbar } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env.local" });

async function main() {
  console.log("🔑 Setting up operator allowance for DepositMinterV2...");
  
  // Token and contract info
  const lynxTokenId = "0.0.6200902"; // Current LYNX token
  const depositMinterHederaId = "0.0.6213533"; // New DepositMinterV2 contract (fixed decimals)
  
  console.log(`LYNX Token ID: ${lynxTokenId}`);
  console.log(`DepositMinterV2 Contract ID: ${depositMinterHederaId}`);
  
  // Setup Hedera credentials
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
  const operatorKey = process.env.OPERATOR_KEY || "";

  if (!operatorId || !operatorKey) {
    throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
  }

  console.log(`Operator ID: ${operatorId}`);

  try {
    // Initialize Hedera client
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );

    console.log(`\n💰 Setting up allowance for LYNX token transfers...`);
    console.log(`From: Operator (${operatorId})`);
    console.log(`To: DepositMinterV2 (${depositMinterHederaId})`);

    // Set a large allowance (1 billion LYNX tokens in base units)
    const allowanceAmount = 100000000000000000; // 1 billion LYNX (8 decimals)

    const allowanceTx = new AccountAllowanceApproveTransaction()
      .approveTokenAllowance(
        TokenId.fromString(lynxTokenId),                    // LYNX token
        AccountId.fromString(operatorId),                   // Operator (owner/treasury)
        AccountId.fromString(depositMinterHederaId),        // DepositMinterV2 (spender)
        allowanceAmount                                     // Amount
      )
      .setMaxTransactionFee(new Hbar(5));

    console.log("Executing allowance transaction...");
    const response = await allowanceTx.execute(client);
    const receipt = await response.getReceipt(client);

    console.log("✅ Operator allowance set successfully!");
    console.log("Transaction ID:", response.transactionId.toString());
    console.log("Status:", receipt.status.toString());
    console.log(`Allowance amount: ${allowanceAmount.toString()} LYNX base units`);

    console.log("\n🎉 SUCCESS!");
    console.log("The DepositMinterV2 contract can now transfer LYNX tokens from the operator (treasury) to users.");
    console.log("This allowance will persist on the network until modified.");

    client.close();

  } catch (error) {
    console.error("❌ Error setting operator allowance:", error);
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