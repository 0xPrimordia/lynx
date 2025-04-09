const { 
  AccountId, 
  Client, 
  TokenId,
  TokenInfoQuery,
  PrivateKey
} = require('@hashgraph/sdk');
const fs = require('fs');

// Read environment variables
const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');
const env = {};

for (const line of lines) {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  }
}

// Get key values
const operatorId = env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = env.OPERATOR_KEY;
const lynxContractId = env.NEXT_PUBLIC_LYNX_CONTRACT_ID;
const lynxTokenId = env.NEXT_PUBLIC_LYNX_TOKEN_ID;

console.log(`Operator ID: ${operatorId}`);
console.log(`Operator Key exists: ${!!operatorKey}`);
console.log(`Contract ID: ${lynxContractId}`);
console.log(`Token ID: ${lynxTokenId}`);

async function checkTokenSupplyKey() {
  if (!operatorId || !operatorKey) {
    console.error('Missing operator credentials');
    return false;
  }

  // Create client and set operator
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );

  try {
    console.log(`Checking token info for ${lynxTokenId}...`);
    
    // Convert to proper format
    const tokenIdObj = TokenId.fromString(lynxTokenId);
    
    // Query the token info to check its supply key
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenIdObj)
      .execute(client);
    
    console.log("Token info retrieved:");
    console.log(`Token name: ${tokenInfo.name}`);
    console.log(`Token symbol: ${tokenInfo.symbol}`);
    console.log(`Treasury account: ${tokenInfo.treasuryAccountId?.toString()}`);
    
    // Check if supply key exists and print it
    if (tokenInfo.supplyKey) {
      console.log(`Supply key is set to: ${tokenInfo.supplyKey.toString()}`);
      console.log(`Contract ID: ${lynxContractId}`);
      
      // Compare with the contract ID
      const contractIdString = `0.0.${lynxContractId.split('.')[2]}`;
      const hasSupplyKey = tokenInfo.supplyKey.toString() === contractIdString;
      console.log(`Contract has supply key: ${hasSupplyKey}`);
      return hasSupplyKey;
    } else {
      console.log("Token does not have a supply key set");
      return false;
    }
  } catch (error) {
    console.error("Error checking token supply key:", error.message);
    return false;
  }
}

checkTokenSupplyKey()
  .then(result => {
    console.log(`Final result: ${result}`);
    process.exit(0);
  })
  .catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  }); 