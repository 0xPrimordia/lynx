import { DAppConnector } from '@hashgraph/hedera-wallet-connect';

/**
 * Check if account is associated with token using server API
 */
export const checkTokenAssociation = async (accountId: string, tokenId: string): Promise<boolean> => {
  try {
    console.log(`[UTILS] Checking association for ${accountId} with ${tokenId}`);
    
    const response = await fetch('/api/check-association', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId, tokenId })
    });

    if (!response.ok) {
      console.error(`[UTILS] Association check failed: ${response.status}`);
      return false;
    }

    const data = await response.json();
    console.log(`[UTILS] Association result: ${data.isAssociated}`);
    
    return data.isAssociated;
  } catch (error) {
    console.error('[UTILS] Error checking token association:', error);
    return false;
  }
};

/**
 * Create association transaction using server API
 */
export const createAssociationTransaction = async (accountId: string, tokenId: string): Promise<string | null> => {
  try {
    console.log(`[UTILS] Creating association transaction for ${accountId} with ${tokenId}`);
    
    const response = await fetch('/api/associate-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId, tokenId })
    });

    if (!response.ok) {
      console.error(`[UTILS] Association transaction creation failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.success || !data.transaction) {
      console.error('[UTILS] Association transaction creation failed:', data.error);
      return null;
    }

    console.log(`[UTILS] Association transaction created successfully`);
    return data.transaction;
  } catch (error) {
    console.error('[UTILS] Error creating association transaction:', error);
    return null;
  }
};

/**
 * Execute transaction through extension wallet
 */
export const executeTransaction = async (
  transaction: string,
  accountId: string,
  connector: DAppConnector,
  description: string = 'Transaction'
): Promise<{ success: boolean; txId?: string; error?: string }> => {
  try {
    console.log(`[UTILS] Executing ${description} for account ${accountId}`);

    const response = await connector.signAndExecuteTransaction({
      signerAccountId: accountId,
      transactionList: transaction
    });

    console.log(`[UTILS] ${description} executed successfully:`, response);
    
    return {
      success: true,
      txId: String(response?.id || 'unknown')
    };

  } catch (error) {
    console.error(`[UTILS] Error executing ${description}:`, error);
    
    // Handle empty error objects (wallet popup closed)
    if (error && typeof error === 'object' && Object.keys(error).length === 0) {
      return {
        success: false,
        error: 'Transaction was rejected or wallet popup was closed'
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Proactive association management - check and associate tokens as needed
 */
export const ensureTokenAssociation = async (
  accountId: string,
  tokenId: string,
  connector: DAppConnector
): Promise<{ success: boolean; wasAssociated: boolean; txId?: string; error?: string }> => {
  try {
    console.log(`[UTILS] Ensuring association for ${accountId} with ${tokenId}`);

    // Check if already associated
    const isAssociated = await checkTokenAssociation(accountId, tokenId);
    
    if (isAssociated) {
      console.log(`[UTILS] Token ${tokenId} is already associated with ${accountId}`);
      return {
        success: true,
        wasAssociated: true
      };
    }

    console.log(`[UTILS] Token ${tokenId} needs association with ${accountId}`);

    // Create association transaction
    const transaction = await createAssociationTransaction(accountId, tokenId);
    
    if (!transaction) {
      return {
        success: false,
        wasAssociated: false,
        error: 'Failed to create association transaction'
      };
    }

    // Execute association transaction
    const result = await executeTransaction(transaction, accountId, connector, 'Token Association');
    
    if (result.success) {
      console.log(`[UTILS] Token ${tokenId} successfully associated with ${accountId}`);
      return {
        success: true,
        wasAssociated: false,
        txId: result.txId
      };
    } else {
      return {
        success: false,
        wasAssociated: false,
        error: result.error
      };
    }

  } catch (error) {
    console.error('[UTILS] Error ensuring token association:', error);
    return {
      success: false,
      wasAssociated: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Batch association check for multiple tokens
 */
export const checkMultipleTokenAssociations = async (
  accountId: string,
  tokenIds: string[]
): Promise<{ [tokenId: string]: boolean }> => {
  const results: { [tokenId: string]: boolean } = {};
  
  // Check each token association in parallel
  const promises = tokenIds.map(async (tokenId) => {
    const isAssociated = await checkTokenAssociation(accountId, tokenId);
    results[tokenId] = isAssociated;
  });

  await Promise.all(promises);
  
  return results;
};

/**
 * Get unassociated tokens from a list
 */
export const getUnassociatedTokens = async (
  accountId: string,
  tokenIds: string[]
): Promise<string[]> => {
  const associations = await checkMultipleTokenAssociations(accountId, tokenIds);
  
  return tokenIds.filter(tokenId => !associations[tokenId]);
}; 