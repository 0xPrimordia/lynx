require('dotenv').config({ path: '.env.local' }); // Load environment variables

const { 
  Client, 
  AccountId, 
  PrivateKey, 
  ContractId, 
  ContractCallQuery,
  ContractFunctionParameters,
  Hbar
} = require('@hashgraph/sdk');

// Test account and token IDs
const operatorId = process.env.OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
const contractId = process.env.LYNX_CONTRACT_ID || '0.0.5758264';
const testAccountId = process.env.OPERATOR_ID;
const lynxTokenId = process.env.NEXT_PUBLIC_LYNX_TOKEN_ID || '0.0.3059001';
const sauceTokenId = process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID || '0.0.1183558';
const clxyTokenId = process.env.NEXT_PUBLIC_CLXY_TOKEN_ID || '0.0.1318237';

async function checkTokenAssociation(tokenId, accountId) {
  if (!operatorId || !operatorKey || !tokenId || !accountId) {
    console.error('Missing required environment variables or parameters');
    return false;
  }
  
  try {
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromString(contractId))
      .setGas(5_000_000)
      .setFunction(
        'isTokenAssociated',
        new ContractFunctionParameters()
          .addString(tokenId)
          .addString(accountId)
      )
      .setQueryPayment(new Hbar(0.1));
    
    const response = await query.execute(client);
    const isAssociated = response.getBool();
    
    return isAssociated;
  } catch (error) {
    console.error('Error checking token association:', error);
    return false;
  }
}

async function runTest() {
  console.log('Testing token association check server action...');
  console.log('-------------------------');
  console.log(`Using test account: ${testAccountId}`);
  console.log(`Using LYNX token: ${lynxTokenId}`);
  console.log(`Using SAUCE token: ${sauceTokenId}`);
  console.log(`Using CLXY token: ${clxyTokenId}`);
  console.log('-------------------------');

  try {
    // Check LYNX token association
    console.log('Checking LYNX token association...');
    const lynxAssociated = await checkTokenAssociation(lynxTokenId, testAccountId);
    console.log(`LYNX token associated: ${lynxAssociated}`);

    // Check SAUCE token association
    console.log('\nChecking SAUCE token association...');
    const sauceAssociated = await checkTokenAssociation(sauceTokenId, testAccountId);
    console.log(`SAUCE token associated: ${sauceAssociated}`);

    // Check CLXY token association
    console.log('\nChecking CLXY token association...');
    const clxyAssociated = await checkTokenAssociation(clxyTokenId, testAccountId);
    console.log(`CLXY token associated: ${clxyAssociated}`);

    console.log('\nToken association check results:');
    console.log(`LYNX: ${lynxAssociated ? 'Associated ✅' : 'Not Associated ❌'}`);
    console.log(`SAUCE: ${sauceAssociated ? 'Associated ✅' : 'Not Associated ❌'}`);
    console.log(`CLXY: ${clxyAssociated ? 'Associated ✅' : 'Not Associated ❌'}`);
  } catch (error) {
    console.error('Error running token association checks:', error);
  }
}

runTest(); 