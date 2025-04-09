import { task } from "hardhat/config";
import { HederaManager } from "../scripts/utils/hedera";
import { Hbar } from "@hashgraph/sdk";

task("token:create", "Creates a new index token")
  .addParam("name", "Token name")
  .addParam("symbol", "Token symbol")
  .addParam("memo", "Token memo")
  .setAction(async (taskArgs, hre) => {
    const hedera = HederaManager.getInstance();
    const { name, symbol, memo } = taskArgs;

    // Implementation will be added later
    console.log(`Creating token: ${name} (${symbol})`);
  });

task("token:check-balance", "Checks token balance for an account")
  .addParam("account", "Account ID to check")
  .setAction(async (taskArgs, hre) => {
    const hedera = HederaManager.getInstance();
    const balance = await hedera.checkBalance(taskArgs.account);
    console.log(`Account ${taskArgs.account} balance: ${balance.toString()}`);
  });

task("token:fund", "Funds a contract with HBAR")
  .addParam("contract", "Contract ID to fund")
  .addParam("amount", "Amount of HBAR to send")
  .setAction(async (taskArgs, hre) => {
    const hedera = HederaManager.getInstance();
    const amount = Hbar.fromTinybars(parseInt(taskArgs.amount));
    await hedera.fundContract(taskArgs.contract, amount);
    console.log(`Funded contract ${taskArgs.contract} with ${amount.toString()}`);
  }); 