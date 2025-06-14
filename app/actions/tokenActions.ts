'use server';
import { Client, AccountId, PrivateKey, ContractId, ContractCallQuery, ContractFunctionParameters, Hbar } from '@hashgraph/sdk';

/**
 * Server action to check if a token is associated with an account
 * This approach keeps private keys secure on the server
 */
export async function checkTokenAssociation(tokenId: string, accountId: string): Promise<boolean> {
  // Server-side secure access to environment variables
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  const contractId = process.env.NEXT_PUBLIC_LYNX_CONTRACT_ID || '0.0.5758264';
  
  console.log(`[SERVER] Checking association for token ${tokenId} with account ${accountId}`);
  
  if (!operatorId || !operatorKey || !tokenId || !accountId) {
    console.error('[SERVER] Missing required environment variables or parameters');
    if (!operatorId) console.error('[SERVER] NEXT_PUBLIC_OPERATOR_ID is missing');
    if (!operatorKey) console.error('[SERVER] OPERATOR_KEY is missing');
    if (!tokenId) console.error('[SERVER] tokenId parameter is missing');
    if (!accountId) console.error('[SERVER] accountId parameter is missing');
    return false;
  }
  
  try {
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    console.log(`[SERVER] Executing isTokenAssociated query on contract ${contractId}`);
    
    // Create a promise that will resolve with the result or timeout after 5 seconds
    const result = await Promise.race([
      // The actual query
      (async () => {
        try {
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
          console.log(`[SERVER] Token ${tokenId} association result for account ${accountId}: ${isAssociated}`);
          return isAssociated;
        } catch (error) {
          console.error('[SERVER] Error executing token association query:', error);
          throw error;
        }
      })(),
      
      // The timeout promise
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.warn('[SERVER] Token association check timed out after 5 seconds');
          reject(new Error('Token association check timed out'));
        }, 5000);
      })
    ]);
    
    return result;
  } catch (error) {
    // If there was a timeout or other error, log it but don't assume association status
    console.error('[SERVER] Error checking token association:', error);
    // Return false to be safe - this may trigger an association attempt, but that will
    // also check if the token is already associated before proceeding
    return false;
  }
}

/**
 * Server action to associate a token with an account
 * This will be used if a token is not already associated
 */
export async function associateToken(tokenId: string, accountId: string): Promise<{ 
  success: boolean, 
  message: string, 
  transactionId?: string
}> {
  // Server-side secure access to environment variables
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  // Debug logging
  console.log('[SERVER] Debug environment variables in associateToken:');
  console.log('[SERVER] tokenId:', tokenId);
  console.log('[SERVER] accountId:', accountId);
  console.log('[SERVER] NEXT_PUBLIC_OPERATOR_ID exists:', !!process.env.NEXT_PUBLIC_OPERATOR_ID);
  console.log('[SERVER] OPERATOR_KEY exists:', !!process.env.OPERATOR_KEY);
  console.log('[SERVER] NEXT_PUBLIC_LYNX_CONTRACT_ID exists:', !!process.env.NEXT_PUBLIC_LYNX_CONTRACT_ID);
  console.log('[SERVER] NEXT_PUBLIC_LYNX_TOKEN_ID exists:', !!process.env.NEXT_PUBLIC_LYNX_TOKEN_ID);
  console.log('[SERVER] NEXT_PUBLIC_SAUCE_TOKEN_ID exists:', !!process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID);
  console.log('[SERVER] NEXT_PUBLIC_CLXY_TOKEN_ID exists:', !!process.env.NEXT_PUBLIC_CLXY_TOKEN_ID);
  
  console.log(`[SERVER] Associating token ${tokenId} with account ${accountId}`);
  
  if (!operatorId || !operatorKey || !tokenId || !accountId) {
    console.error('[SERVER] Missing required environment variables or parameters');
    if (!operatorId) console.error('[SERVER] NEXT_PUBLIC_OPERATOR_ID is missing');
    if (!operatorKey) console.error('[SERVER] OPERATOR_KEY is missing');
    if (!tokenId) console.error('[SERVER] tokenId parameter is missing');
    if (!accountId) console.error('[SERVER] accountId parameter is missing');
    return { 
      success: false, 
      message: 'Missing required environment variables or parameters' 
    };
  }
  
  try {
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    // First, check if the token is already associated
    const isAlreadyAssociated = await checkTokenAssociation(tokenId, accountId);
    if (isAlreadyAssociated) {
      console.log(`[SERVER] Token ${tokenId} is already associated with account ${accountId}`);
      return { 
        success: true, 
        message: 'Token is already associated' 
      };
    }
    
    // Instead, return instructions for the client to perform the association
    console.log(`[SERVER] Cannot associate token directly - user must sign association`);
    return { 
      success: false, 
      message: 'Token association must be performed by the account owner directly. Please associate the token using your wallet.' 
    };
  } catch (error) {
    console.error('[SERVER] Error associating token:', error);
    return { 
      success: false, 
      message: `Error associating token: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}
