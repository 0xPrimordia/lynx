const { 
  AccountId, 
  Client, 
  ContractId, 
  PrivateKey,
  ContractExecuteTransaction,
  ContractFunctionParameters,
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

async function callCheckSupplyKey() {
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
    console.log(`Calling checkSupplyKey on contract ${lynxContractId}...`);
    
    // Convert to proper format
    const contractIdObj = ContractId.fromString(lynxContractId);
    
    // Create the contract call transaction to trigger the checkSupplyKey function
    const transaction = new ContractExecuteTransaction()
      .setContractId(contractIdObj)
      .setGas(100000)
      .setFunction("checkSupplyKey");
    
    // Submit the transaction
    console.log("Executing contract transaction...");
    const response = await transaction.execute(client);
    
    // Get receipt to ensure success
    console.log("Getting receipt...");
    const receipt = await response.getReceipt(client);
    
    console.log(`Transaction status: ${receipt.status.toString()}`);
    
    // Now query the hasSupplyKey variable to see if it updated
    console.log("Querying hasSupplyKey variable...");
    const query = new ContractCallQuery()
      .setContractId(contractIdObj)
      .setGas(100000)
      .setFunction("hasSupplyKey");
    
    const queryResponse = await query.execute(client);
    const hasSupplyKey = queryResponse.getBool(0);
    
    console.log(`Contract's hasSupplyKey value: ${hasSupplyKey}`);
    
    return hasSupplyKey;
  } catch (error) {
    console.error("Error calling checkSupplyKey:", error.message);
    return false;
  }
}

callCheckSupplyKey()
  .then(result => {
    console.log(`Final result: ${result}`);
    process.exit(0);
  })
  .catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  }); 