#!/usr/bin/env tsx

/**
 * Script to check if contract ratios are in sync with governance snapshot ratios
 */

import dotenv from 'dotenv';
import { Client, ContractCallQuery, ContractId, AccountId, PrivateKey } from '@hashgraph/sdk';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Environment setup
const HEDERA_NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
const DEPOSIT_MINTER_V2_ID = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_V2_HEDERA_ID || '0.0.6434231';
const SNAPSHOT_TOPIC_ID = process.env.NEXT_PUBLIC_SNAPSHOT_TOPIC_ID || '0.0.6495309';

interface ContractRatios {
  hbarRatio: number;
  wbtcRatio: number;
  sauceRatio: number;
  usdcRatio: number;
  jamRatio: number;
  headstartRatio: number;
}

interface SnapshotRatios {
  HBAR: number;
  WBTC: number;
  SAUCE: number;
  USDC: number;
  JAM: number;
  HEADSTART: number;
}

async function getCurrentContractRatios(): Promise<ContractRatios> {
  console.log('📡 Fetching current contract ratios...');
  
  // Get environment variables
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.NEXT_PUBLIC_OPERATOR_KEY;
  
  if (!operatorId || !operatorKey) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_OPERATOR_ID, NEXT_PUBLIC_OPERATOR_KEY');
  }
  
  const client = HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromString(operatorKey));
  
  try {
    // Call getCurrentRatios() on the contract
    const contractCall = new ContractCallQuery()
      .setContractId(ContractId.fromString(DEPOSIT_MINTER_V2_ID))
      .setGas(100000)
      .setFunction('getCurrentRatios');
    
    const result = await contractCall.execute(client);
    
    const contractRatios: ContractRatios = {
      hbarRatio: parseInt(result.getUint256(0).toString()),
      wbtcRatio: parseInt(result.getUint256(1).toString()),
      sauceRatio: parseInt(result.getUint256(2).toString()),
      usdcRatio: parseInt(result.getUint256(3).toString()),
      jamRatio: parseInt(result.getUint256(4).toString()),
      headstartRatio: parseInt(result.getUint256(5).toString())
    };
    
    console.log('✅ Contract ratios retrieved:', contractRatios);
    return contractRatios;
    
  } catch (error) {
    console.error('❌ Error fetching contract ratios:', error);
    throw error;
  } finally {
    client.close();
  }
}

async function getCurrentSnapshotRatios(): Promise<SnapshotRatios | null> {
  console.log('🔍 Fetching current snapshot ratios...');
  
  const mirrorNodeUrl = HEDERA_NETWORK === 'mainnet' 
    ? 'https://mainnet-public.mirrornode.hedera.com'
    : 'https://testnet.mirrornode.hedera.com';
  
  try {
    const url = `${mirrorNodeUrl}/api/v1/topics/${SNAPSHOT_TOPIC_ID}/messages?order=desc&limit=10`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mirror node request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Find the most recent HCS-2 token ratio snapshot
    for (const message of data.messages) {
      try {
        const messageData = Buffer.from(message.message, 'base64').toString('utf-8');
        const parsed = JSON.parse(messageData);
        
        if (parsed.p === 'hcs-2' && parsed.op === 'register' && parsed.metadata) {
          const metadataObj = JSON.parse(parsed.metadata);
          
          if (metadataObj.snapshot_type === 'token_ratios') {
            console.log('✅ Found snapshot ratios:', metadataObj.token_weights);
            console.log('📅 Snapshot timestamp:', metadataObj.timestamp);
            console.log('🆔 Snapshot ID:', metadataObj.snapshot_id);
            
            return metadataObj.token_weights as SnapshotRatios;
          }
        }
      } catch (parseError) {
        continue; // Skip unparseable messages
      }
    }
    
    console.log('❌ No token ratio snapshots found');
    return null;
    
  } catch (error) {
    console.error('❌ Error fetching snapshot ratios:', error);
    throw error;
  }
}

function convertContractRatiosToTokenAmounts(contractRatios: ContractRatios): SnapshotRatios {
  // Return RAW contract ratios without any conversion - these are the exact values from getCurrentRatios()
  return {
    HBAR: contractRatios.hbarRatio,
    WBTC: contractRatios.wbtcRatio,
    SAUCE: contractRatios.sauceRatio,
    USDC: contractRatios.usdcRatio,
    JAM: contractRatios.jamRatio,
    HEADSTART: contractRatios.headstartRatio
  };
}

function compareRatios(contractRatios: SnapshotRatios, snapshotRatios: SnapshotRatios): void {
  console.log('\n📊 RATIO COMPARISON');
  console.log('='.repeat(60));
  
  const tokens = ['HBAR', 'WBTC', 'SAUCE', 'USDC', 'JAM', 'HEADSTART'] as const;
  let allMatch = true;
  
  console.log(`${'TOKEN'.padEnd(12)} ${'CONTRACT'.padEnd(12)} ${'SNAPSHOT'.padEnd(12)} ${'STATUS'.padEnd(10)}`);
  console.log('-'.repeat(60));
  
  for (const token of tokens) {
    const contractValue = contractRatios[token];
    const snapshotValue = snapshotRatios[token];
    const matches = Math.abs(contractValue - snapshotValue) < 0.0001; // Allow tiny floating point differences
    
    if (!matches) allMatch = false;
    
    const status = matches ? '✅ MATCH' : '❌ MISMATCH';
    const contractStr = contractValue.toString();
    const snapshotStr = snapshotValue.toString();
    
    console.log(`${token.padEnd(12)} ${contractStr.padEnd(12)} ${snapshotStr.padEnd(12)} ${status}`);
  }
  
  console.log('='.repeat(60));
  
  if (allMatch) {
    console.log('🎉 ALL RATIOS MATCH! Contract and snapshot are in sync.');
  } else {
    console.log('⚠️  RATIOS ARE OUT OF SYNC! This will cause minting failures.');
    console.log('\n💡 Solutions:');
    console.log('1. Update the snapshot ratios to match the contract');
    console.log('2. Or call updateRatios() on the contract to match the snapshot');
  }
}

async function main() {
  console.log('🔄 CHECKING RATIO SYNCHRONIZATION');
  console.log('='.repeat(50));
  console.log(`Contract: ${DEPOSIT_MINTER_V2_ID}`);
  console.log(`Snapshot Topic: ${SNAPSHOT_TOPIC_ID}`);
  console.log(`Network: ${HEDERA_NETWORK}`);
  console.log('='.repeat(50));
  
  try {
    // Fetch both sets of ratios
    const [contractRatios, snapshotRatios] = await Promise.all([
      getCurrentContractRatios(),
      getCurrentSnapshotRatios()
    ]);
    
    if (!snapshotRatios) {
      console.log('❌ Cannot compare - no snapshot ratios found');
      process.exit(1);
    }
    
    // Convert contract ratios to token amounts for comparison
    const contractTokenAmounts = convertContractRatiosToTokenAmounts(contractRatios);
    
    // Compare the ratios
    compareRatios(contractTokenAmounts, snapshotRatios);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { getCurrentContractRatios, getCurrentSnapshotRatios, compareRatios };