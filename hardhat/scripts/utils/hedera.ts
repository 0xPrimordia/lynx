import { Client, AccountId, PrivateKey, Hbar, AccountBalanceQuery, TransferTransaction } from "@hashgraph/sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env.local" });

export class HederaManager {
  private static instance: HederaManager;
  private client: Client;

  private constructor() {
    this.client = this.initializeClient();
  }

  static getInstance(): HederaManager {
    if (!HederaManager.instance) {
      HederaManager.instance = new HederaManager();
    }
    return HederaManager.instance;
  }

  private initializeClient(): Client {
    const client = Client.forTestnet();
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;

    if (!operatorId || !operatorKey) {
      throw new Error("Missing operator credentials in .env.local");
    }

    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );

    return client;
  }

  getClient(): Client {
    return this.client;
  }

  async checkBalance(accountId: string): Promise<Hbar> {
    const balance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(this.client);
    
    return balance.hbars;
  }

  async fundContract(contractId: string, amount: Hbar): Promise<void> {
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    if (!operatorId) throw new Error("Missing operator ID");

    const transferTx = new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(operatorId), amount.negated())
      .addHbarTransfer(AccountId.fromString(contractId), amount);

    await transferTx.execute(this.client);
  }

  async ensureMinimumBalance(accountId: string, minimum: Hbar): Promise<boolean> {
    const balance = await this.checkBalance(accountId);
    return balance.toTinybars() >= minimum.toTinybars();
  }
} 