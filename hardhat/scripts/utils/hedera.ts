import { Client, AccountId, PrivateKey, Hbar, AccountBalanceQuery, TransferTransaction, ContractId } from "@hashgraph/sdk";
import * as dotenv from "dotenv";
import { ethers } from "hardhat";
import path from 'path';
import fs from 'fs';

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

/**
 * Converts a Hedera ID (0.0.123456) to an EVM address (0x...padded)
 * @param hederaId The Hedera account ID in shard.realm.account format
 * @returns The corresponding EVM address
 */
export function hederaIdToEvmAddress(hederaId: string): string {
  const accountNum = hederaId.split('.').pop() || "0";
  const paddedAccountNum = accountNum.padStart(40, '0');
  return `0x${paddedAccountNum}`;
}

/**
 * Converts an EVM address to a Hedera ID format
 * @param evmAddress The EVM address
 * @returns The Hedera ID in 0.0.number format
 */
export function evmAddressToHederaId(evmAddress: string): string {
  if (evmAddress.length !== 42) {
    throw new Error(`Invalid EVM address: ${evmAddress}`);
  }
  
  try {
    // Use the Hedera SDK's ContractId to convert EVM address to Hedera ID
    const contractId = ContractId.fromSolidityAddress(evmAddress);
    return contractId.toString();
  } catch (error) {
    // Fallback to the direct conversion in case of SDK issues
    const hex = evmAddress.replace("0x", "");
    const num = BigInt(`0x${hex}`);
    return `0.0.${num.toString()}`;
  }
}

/**
 * Gets deployment info from the deployment-info.json file
 * @returns The deployment info object
 */
export function getDeploymentInfo(): any {
  const deploymentInfoPath = path.join(__dirname, '../../../deployment-info.json');
  return require(deploymentInfoPath);
}

/**
 * Saves deployment info to the deployment-info.json file
 * @param info The deployment info object
 */
export function saveDeploymentInfo(info: any): void {
  const deploymentInfoPath = path.join(__dirname, '../../../deployment-info.json');
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(info, null, 2));
} 