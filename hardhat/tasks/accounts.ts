import { task } from "hardhat/config";
import { HederaManager } from "../scripts/utils/hedera";
import { Hbar } from "@hashgraph/sdk";

task("accounts:info", "Shows information about the operator account")
  .setAction(async (taskArgs, hre) => {
    const hedera = HederaManager.getInstance();
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    
    if (!operatorId) {
      console.error("No operator ID found in environment");
      return;
    }

    const balance = await hedera.checkBalance(operatorId);
    console.log("Operator Account Information:");
    console.log(`Account ID: ${operatorId}`);
    console.log(`Balance: ${balance.toString()}`);
  });

task("accounts:check-minimum", "Checks if an account has minimum balance")
  .addParam("account", "Account ID to check")
  .addParam("minimum", "Minimum HBAR amount required")
  .setAction(async (taskArgs, hre) => {
    const hedera = HederaManager.getInstance();
    const minimum = Hbar.fromTinybars(parseInt(taskArgs.minimum));
    const hasMinimum = await hedera.ensureMinimumBalance(taskArgs.account, minimum);
    
    if (hasMinimum) {
      console.log(`Account ${taskArgs.account} has sufficient balance (minimum ${minimum.toString()})`);
    } else {
      console.log(`Account ${taskArgs.account} has insufficient balance (minimum ${minimum.toString()})`);
    }
  }); 