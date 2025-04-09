const fs = require('fs');
const { 
  AccountId, 
  Client, 
  ContractCallQuery, 
  ContractId, 
  PrivateKey,
  ContractFunctionParameters
} = require('@hashgraph/sdk');

// Read .env.local line by line directly
console.log('Reading environment file...');
const envContent = fs.readFileSync('.env.local', 'utf8');
console.log('Raw env file content:', envContent);

// Parse environment variables manually
const lines = envContent.split('\n');
const env = {};

for (const line of lines) {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('='); // Handle values with = in them
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  }
}

console.log('Parsed environment variables:');
for (const [key, value] of Object.entries(env)) {
  if (key === 'OPERATOR_KEY') {
    console.log(`${key}: [REDACTED]`);
  } else {
    console.log(`${key}: ${value}`);
  }
}

// Use the values directly
const operatorId = env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = env.OPERATOR_KEY;
const lynxContractId = env.NEXT_PUBLIC_LYNX_CONTRACT_ID;
const lynxTokenId = env.NEXT_PUBLIC_LYNX_TOKEN_ID;

console.log('\nValues extracted:');
console.log('Operator ID:', operatorId);
console.log('Operator Key exists:', !!operatorKey);
console.log('Operator Key length:', operatorKey ? operatorKey.length : 0);
console.log('LYNX Contract ID:', lynxContractId);
console.log('LYNX Token ID:', lynxTokenId);

async function checkSupplyKey() {
  if (!operatorId || !operatorKey) {
    console.error('Missing operator credentials.');
    return false;
  }

  // Create a client for the testnet
  const client = Client.forTestnet();
  
  try {
    // Set the operator account
    console.log(`Setting operator: ${operatorId} with key length: ${operatorKey.length}`);
    client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromString(operatorKey));
    
    console.log('Operator set successfully');

    // Try getting contract info first to check connection
    console.log(`Checking contract info for ${lynxContractId}`);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromString(lynxContractId))
      .setGas(100000)
      .setFunction("hasSupplyKey");
      
    console.log('Executing query...');
    const response = await query.execute(client);
    console.log('Query executed successfully');
    
    const hasSupplyKey = response.getBool(0);
    console.log(`Contract has supply key: ${hasSupplyKey}`);
    return hasSupplyKey;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (error.message.includes('function selector was not found')) {
      console.log('Function "hasSupplyKey" not found, trying "checkSupplyKey"');
      try {
        const query = new ContractCallQuery()
          .setContractId(ContractId.fromString(lynxContractId))
          .setGas(100000)
          .setFunction("checkSupplyKey");
        
        await query.execute(client);
        console.log('checkSupplyKey executed successfully');
        return true;
      } catch (innerError) {
        console.error(`Inner error: ${innerError.message}`);
        return false;
      }
    }
    return false;
  }
}

checkSupplyKey()
  .then(result => console.log(`Final result: ${result}`))
  .catch(err => console.error('Error running check:', err)); 