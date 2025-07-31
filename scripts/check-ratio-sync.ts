import { Client, PrivateKey, AccountId, ContractId } from '@hashgraph/sdk';
import * as dotenv from 'dotenv';
import { ContractCallQuery } from '@hashgraph/sdk';

dotenv.config({ path: '.env.local' });

async function checkRatioSync() {
  console.log('🔍 Checking ratio synchronization between contract and governance snapshot...\n');

  // Initialize Hedera client
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID!;
  const operatorKey = process.env.NEXT_PUBLIC_OPERATOR_KEY!;
  
  if (!operatorId || !operatorKey) {
    throw new Error('Missing operator credentials');
  }

  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );

  // Contract addresses from deployment info
  const contractId = process.env.NEXT_PUBLIC_LYNX_CONTRACT_HEDERA_ID!;
  const snapshotTopicId = process.env.NEXT_PUBLIC_SNAPSHOT_TOPIC_ID!;

  if (!contractId || !snapshotTopicId) {
    throw new Error('Missing contract or snapshot topic ID');
  }

  console.log('📋 Configuration:');
  console.log(`- Contract ID: ${contractId}`);
  console.log(`- Snapshot Topic ID: ${snapshotTopicId}\n`);

  // 1. Fetch current contract ratios
  console.log('1️⃣ Fetching current contract ratios...');
  let contractRatios: any = {};
  
  try {
    const contract = ContractId.fromString(contractId);
    
    // Call getCurrentRatios() on the contract
    const ratiosQuery = new ContractCallQuery()
      .setContractId(contract)
      .setGas(100000)
      .setFunction("getCurrentRatios");

    const ratiosResult = await ratiosQuery.execute(client);
    
    contractRatios = {
      HBAR: ratiosResult.getUint256(0),
      WBTC: ratiosResult.getUint256(1),
      SAUCE: ratiosResult.getUint256(2),
      USDC: ratiosResult.getUint256(3),
      JAM: ratiosResult.getUint256(4),
      HEADSTART: ratiosResult.getUint256(5)
    };

    console.log('📊 Contract Ratios:');
    console.log(`- HBAR_RATIO: ${contractRatios.HBAR}`);
    console.log(`- WBTC_RATIO: ${contractRatios.WBTC}`);
    console.log(`- SAUCE_RATIO: ${contractRatios.SAUCE}`);
    console.log(`- USDC_RATIO: ${contractRatios.USDC}`);
    console.log(`- JAM_RATIO: ${contractRatios.JAM}`);
    console.log(`- HEADSTART_RATIO: ${contractRatios.HEADSTART}\n`);

  } catch (error) {
    console.error('❌ Failed to fetch contract ratios:', error);
    return;
  }

  // 2. Fetch latest governance snapshot
  console.log('2️⃣ Fetching latest governance snapshot...');
  try {
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const mirrorNodeUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    const url = `${mirrorNodeUrl}/api/v1/topics/${snapshotTopicId}/messages?order=desc&limit=10`;
    console.log(`Fetching from: ${url}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mirror node request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.messages || data.messages.length === 0) {
      console.log('❌ No messages found in snapshot topic');
      return;
    }

    console.log(`Found ${data.messages.length} messages in snapshot topic`);

    // Look for the most recent token ratio snapshot
    for (const message of data.messages) {
      try {
        const decodedMessage = Buffer.from(message.message, 'base64').toString('utf-8');
        const parsed = JSON.parse(decodedMessage);
        
        // Check if this is a token ratio snapshot
        if (parsed.type === 'token_ratio_snapshot' || parsed.data?.type === 'token_ratio_snapshot') {
          console.log('📋 Found token ratio snapshot:');
          console.log(JSON.stringify(parsed, null, 2));
          
          // Extract ratios from snapshot
          const snapshotRatios = parsed.data?.ratios || parsed.ratios;
          
          if (snapshotRatios) {
            console.log('\n📊 Snapshot Ratios:');
            console.log(`- HBAR: ${snapshotRatios.HBAR}`);
            console.log(`- WBTC: ${snapshotRatios.WBTC}`);
            console.log(`- SAUCE: ${snapshotRatios.SAUCE}`);
            console.log(`- USDC: ${snapshotRatios.USDC}`);
            console.log(`- JAM: ${snapshotRatios.JAM}`);
            console.log(`- HEADSTART: ${snapshotRatios.HEADSTART}`);
            
            // Compare with contract ratios
            console.log('\n🔍 Comparison:');
            console.log('Contract vs Snapshot:');
            console.log(`- HBAR: ${contractRatios.HBAR} vs ${snapshotRatios.HBAR} - ${contractRatios.HBAR === snapshotRatios.HBAR ? '✅ Match' : '❌ Mismatch'}`);
            console.log(`- WBTC: ${contractRatios.WBTC} vs ${snapshotRatios.WBTC} - ${contractRatios.WBTC === snapshotRatios.WBTC ? '✅ Match' : '❌ Mismatch'}`);
            console.log(`- SAUCE: ${contractRatios.SAUCE} vs ${snapshotRatios.SAUCE} - ${contractRatios.SAUCE === snapshotRatios.SAUCE ? '✅ Match' : '❌ Mismatch'}`);
            console.log(`- USDC: ${contractRatios.USDC} vs ${snapshotRatios.USDC} - ${contractRatios.USDC === snapshotRatios.USDC ? '✅ Match' : '❌ Mismatch'}`);
            console.log(`- JAM: ${contractRatios.JAM} vs ${snapshotRatios.JAM} - ${contractRatios.JAM === snapshotRatios.JAM ? '✅ Match' : '❌ Mismatch'}`);
            console.log(`- HEADSTART: ${contractRatios.HEADSTART} vs ${snapshotRatios.HEADSTART} - ${contractRatios.HEADSTART === snapshotRatios.HEADSTART ? '✅ Match' : '❌ Mismatch'}`);
          }
          
          break; // Found the snapshot, stop looking
        }
      } catch (parseError) {
        console.log(`Could not parse message ${message.sequence_number}:`, (parseError as Error).message);
        continue;
      }
    }

  } catch (error) {
    console.error('❌ Failed to fetch governance snapshot:', error);
  }

  // 3. Check what the frontend is actually using
  console.log('\n3️⃣ Checking frontend calculation...');
  console.log('The frontend should be using DAO parameters from the governance topic.');
  console.log('If the snapshot ratios don\'t match the contract, the frontend will calculate wrong amounts.\n');

  console.log('🎯 Conclusion:');
  console.log('- If ratios match: Frontend should work correctly');
  console.log('- If ratios don\'t match: Need to update contract or snapshot');
  console.log('- If no snapshot found: Need to create governance snapshot');

  client.close();
}

// Run the check
checkRatioSync().catch(console.error); 