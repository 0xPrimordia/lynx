import { Client, PrivateKey, AccountId, ContractId } from '@hashgraph/sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });

interface DeploymentInfo {
  vaultId: string;
  controllerId: string;
  tokenAddress: string;
}

/**
 * Gets deployment information from the deployment-info.json file
 */
export function getDeploymentInfo(): DeploymentInfo {
  const deploymentInfoPath = path.resolve(process.cwd(), '../../deployment-info.json');
  if (!fs.existsSync(deploymentInfoPath)) {
    throw new Error('Deployment info file not found. Please deploy the contracts first.');
  }
  
  return JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf8'));
}

/**
 * Updates the deployment info with the token address
 */
export function updateDeploymentInfo(tokenAddress: string): void {
  const deploymentInfoPath = path.resolve(process.cwd(), '../../deployment-info.json');
  const deploymentInfo = getDeploymentInfo();
  
  deploymentInfo.tokenAddress = tokenAddress;
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('Deployment info updated with token address');
}

/**
 * Validates that required environment variables are set
 */
export function validateEnvironment(): void {
  const requiredEnvVars = ['NEXT_PUBLIC_OPERATOR_ID', 'OPERATOR_KEY'];
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}. ` +
      'Please check your .env.local file.'
    );
  }
}

/**
 * Creates and configures a Hedera client
 */
export function createHederaClient(): Client {
  validateEnvironment();
  
  // Get operator account and private key from environment
  const operatorId = AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID!);
  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
  
  // Create Hedera client and set the operator
  let client: Client;
  
  if (process.env.HEDERA_TESTNET_ENDPOINT) {
    // Use custom endpoint if provided
    client = Client.forNetwork({
      "testnet.hedera.com:50211": process.env.HEDERA_TESTNET_ENDPOINT
    });
  } else {
    // Use default testnet endpoint
    client = Client.forTestnet();
  }
  
  console.log('Initialized Hedera testnet client');
  
  // Set operator account for client
  client.setOperator(operatorId, operatorKey);
  console.log('Set operator account for client');
  console.log(`Using operator: ${operatorId}`);
  
  return client;
}

/**
 * Converts hex address to Hedera ID format
 * @param hexAddress - A hex string representing the address
 * @returns The Hedera ID format (0.0.X)
 */
export function hexAddressToHederaId(hexAddress: string): string {
  if (hexAddress.startsWith('0x')) {
    hexAddress = hexAddress.substring(2);
  }
  
  // For EVM addresses on Hedera, the contract ID is the last 20 bytes
  // Check if this is a zero address
  if (hexAddress === '0'.repeat(40)) {
    return '0.0.0';
  }
  
  // Extract the shard, realm, and number
  // Note: This is a simplified approach for Hedera's specific EVM addressing
  try {
    // Convert to bigint and then to string
    const num = BigInt(`0x${hexAddress}`);
    return `0.0.${num}`;
  } catch (error) {
    console.error('Failed to convert hex address to Hedera ID:', error);
    return 'Invalid address';
  }
}

/**
 * Converts a ContractId to a Solidity address format
 * @param contractId - The Hedera contract ID in format 0.0.X
 * @returns The 0x-prefixed hex address
 */
export function contractIdToSolidityAddress(contractId: string): string {
  try {
    const id = ContractId.fromString(contractId);
    return `0x${id.toSolidityAddress()}`;
  } catch (error) {
    console.error('Failed to convert contract ID to solidity address:', error);
    return '0x0000000000000000000000000000000000000000';
  }
}

/**
 * Check if a byte array is all zeros
 */
export function isAllZeros(bytes: Uint8Array): boolean {
  return bytes.every(byte => byte === 0);
} 