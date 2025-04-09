const { 
  AccountId, 
  Client, 
  ContractId, 
  PrivateKey,
  ContractExecuteTransaction,
  ContractCallQuery
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

async function updateSupplyKeyStatus() {
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
    console.log(`Calling updateSupplyKeyStatus on contract ${lynxContractId}...`);
    
    // Convert to proper format
    const contractIdObj = ContractId.fromString(lynxContractId);
    
    // First check the current hasSupplyKey value
    console.log("Checking current hasSupplyKey value...");
    let query = new ContractCallQuery()
      .setContractId(contractIdObj)
      .setGas(100000)
      .setFunction("hasSupplyKey");
    
    let queryResponse = await query.execute(client);
    const initialHasSupplyKey = queryResponse.getBool(0);
    console.log(`Initial hasSupplyKey value: ${initialHasSupplyKey}`);
    
    // Create the contract call transaction to update the supply key status
    console.log("Executing updateSupplyKeyStatus transaction...");
    const transaction = new ContractExecuteTransaction()
      .setContractId(contractIdObj)
      .setGas(100000)
      .setFunction("updateSupplyKeyStatus");
    
    // Submit the transaction
    const response = await transaction.execute(client);
    
    // Get receipt to ensure success
    console.log("Getting receipt...");
    const receipt = await response.getReceipt(client);
    
    console.log(`Transaction status: ${receipt.status.toString()}`);
    
    // Check the updated hasSupplyKey value
    console.log("Checking updated hasSupplyKey value...");
    query = new ContractCallQuery()
      .setContractId(contractIdObj)
      .setGas(100000)
      .setFunction("hasSupplyKey");
    
    queryResponse = await query.execute(client);
    const updatedHasSupplyKey = queryResponse.getBool(0);
    
    console.log(`Updated hasSupplyKey value: ${updatedHasSupplyKey}`);
    
    return updatedHasSupplyKey;
  } catch (error) {
    console.error("Error updating supply key status:", error.message);
    return false;
  }
}

updateSupplyKeyStatus()
  .then(result => {
    console.log(`Final result: ${result}`);
    process.exit(0);
  })
  .catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  }); 