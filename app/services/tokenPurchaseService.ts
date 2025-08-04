import { 
  Client, 
  AccountId, 
  TokenId, 
  TransferTransaction,
  Hbar,
  PrivateKey,
  Status,
  AccountBalanceQuery,
  TransactionId,
  TokenAssociateTransaction
} from '@hashgraph/sdk';
import { DAppConnector, transactionToBase64String } from '@hashgraph/hedera-wallet-connect';

export interface TokenPurchaseRequest {
  hbarAmount: number;
  userAccountId: string;
  tokenAmounts: {
    [token: string]: {
      amount: number;
      valueUSD: number;
      weight: number;
    };
  };
}

export interface TokenPurchaseResult {
  success: boolean;
  txId?: string;
  error?: string;
  needsAssociation?: boolean;
  unassociatedTokens?: string[];
  details?: {
    hbarTransferTxId?: string;
    tokenTransferTxIds?: string[];
  };
}

export class TokenPurchaseService {
  private client: Client;
  private operatorId: string;
  private operatorKey: PrivateKey;

  constructor() {
    this.client = Client.forTestnet();
    
    // Get operator credentials from environment
    this.operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || '';
    this.operatorKey = PrivateKey.fromString(process.env.NEXT_PUBLIC_OPERATOR_KEY || '');
    
    if (!this.operatorId || !this.operatorKey) {
      throw new Error('Operator credentials not configured');
    }

    // Set operator account for transactions
    this.client.setOperator(this.operatorId, this.operatorKey);
  }

  /**
   * Execute a complete token purchase transaction
   * 1. Transfer HBAR from user to operator
   * 2. Transfer tokens from operator to user (will fail if not associated)
   */
  public async executeTokenPurchase(
    request: TokenPurchaseRequest,
    connector: DAppConnector
  ): Promise<TokenPurchaseResult> {
    try {
      console.log('[TokenPurchaseService] Starting token purchase:', request);

      // Step 1: Transfer HBAR from user to operator
      const hbarTransferResult = await this.transferHbarFromUser(
        request.hbarAmount,
        request.userAccountId,
        connector
      );

      if (!hbarTransferResult.success) {
        return {
          success: false,
          error: `HBAR transfer failed: ${hbarTransferResult.error}`
        };
      }

      // Step 2: Transfer tokens from operator to user
      const tokenTransferResults = await this.transferTokensToUser(
        request.tokenAmounts,
        request.userAccountId
      );

      // Check if all token transfers succeeded
      const failedTransfers = tokenTransferResults.filter(result => !result.success);
      if (failedTransfers.length > 0) {
        console.error('[TokenPurchaseService] Some token transfers failed:', failedTransfers);
        
        // Check if failures are due to missing associations
        const associationErrors = failedTransfers.filter(result => 
          result.error?.includes('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT') || 
          result.error?.includes('TOKEN_ID_REPEATED_IN_TOKEN_LIST')
        );
        
        if (associationErrors.length > 0) {
          const unassociatedTokens = associationErrors.map(result => result.token).filter(Boolean);
          return {
            success: false,
            error: `Tokens need to be associated: ${unassociatedTokens.join(', ')}`,
            needsAssociation: true,
            unassociatedTokens: unassociatedTokens as string[]
          };
        }
        
        // Note: In a production system, you might want to implement rollback logic here
        return {
          success: false,
          error: `Some token transfers failed: ${failedTransfers.map(f => f.error).join(', ')}`,
          details: {
            hbarTransferTxId: hbarTransferResult.txId,
            tokenTransferTxIds: tokenTransferResults.map(r => r.txId).filter(Boolean) as string[]
          }
        };
      }

      return {
        success: true,
        txId: hbarTransferResult.txId,
        details: {
          hbarTransferTxId: hbarTransferResult.txId,
          tokenTransferTxIds: tokenTransferResults.map(r => r.txId).filter(Boolean) as string[]
        }
      };

    } catch (error) {
      console.error('[TokenPurchaseService] Token purchase failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Transfer HBAR from user to operator using wallet connector
   */
  private async transferHbarFromUser(
    hbarAmount: number,
    userAccountId: string,
    connector: DAppConnector
  ): Promise<{ success: boolean; txId?: string; error?: string }> {
    try {
      console.log(`[TokenPurchaseService] Transferring ${hbarAmount} HBAR from ${userAccountId} to ${this.operatorId}`);

      // Create transfer transaction
      const transferTx = new TransferTransaction()
        .addHbarTransfer(userAccountId, new Hbar(-hbarAmount))
        .addHbarTransfer(this.operatorId, new Hbar(hbarAmount))
        .setTransactionId(TransactionId.generate(AccountId.fromString(userAccountId)))
        .setTransactionMemo('LYNX Token Purchase - HBAR Transfer')
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(this.client);

      // Convert transaction to base64 string
      const txBase64 = transactionToBase64String(transferTx);

      // Execute transaction through wallet connector
      const response = await connector.signAndExecuteTransaction({
        signerAccountId: userAccountId,
        transactionList: txBase64
      });

      console.log('[TokenPurchaseService] HBAR transfer successful:', response);
      
      return {
        success: true,
        txId: String(response?.id || 'unknown')
      };

    } catch (error) {
      console.error('[TokenPurchaseService] HBAR transfer failed:', error);
      
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
  }

  /**
   * Transfer tokens from operator to user
   */
  private async transferTokensToUser(
    tokenAmounts: TokenPurchaseRequest['tokenAmounts'],
    userAccountId: string
  ): Promise<Array<{ success: boolean; txId?: string; error?: string; token?: string }>> {
    const results: Array<{ success: boolean; txId?: string; error?: string; token?: string }> = [];

    // Token ID and decimal mapping
    const tokenConfig: { [key: string]: { id: string; decimals: number } } = {
      WBTC: { id: process.env.NEXT_PUBLIC_WBTC_TOKEN_ID || '0.0.6212930', decimals: 8 },
      SAUCE: { id: process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID || '0.0.1183558', decimals: 6 },
      USDC: { id: process.env.NEXT_PUBLIC_USDC_TOKEN_ID || '0.0.6212931', decimals: 6 },
      JAM: { id: process.env.NEXT_PUBLIC_JAM_TOKEN_ID || '0.0.6212932', decimals: 8 },
      HEADSTART: { id: process.env.NEXT_PUBLIC_HEADSTART_TOKEN_ID || '0.0.6212933', decimals: 8 }
    };

    // Process each token transfer
    for (const [tokenSymbol, tokenData] of Object.entries(tokenAmounts)) {
      try {
        const tokenConfigItem = tokenConfig[tokenSymbol];
        if (!tokenConfigItem) {
          console.warn(`[TokenPurchaseService] No token config found for ${tokenSymbol}`);
          results.push({
            success: false,
            error: `No token configuration for ${tokenSymbol}`,
            token: tokenSymbol
          });
          continue;
        }

        // Convert amount to proper decimal format (multiply by 10^decimals)
        const rawAmount = Math.floor(tokenData.amount * Math.pow(10, tokenConfigItem.decimals));
        
        console.log(`[TokenPurchaseService] Transferring ${tokenData.amount} ${tokenSymbol} (${rawAmount} raw units) to ${userAccountId}`);

        // Create token transfer transaction
        const transferTx = new TransferTransaction()
          .addTokenTransfer(
            TokenId.fromString(tokenConfigItem.id),
            this.operatorId,
            -rawAmount
          )
          .addTokenTransfer(
            TokenId.fromString(tokenConfigItem.id),
            userAccountId,
            rawAmount
          )
          .setTransactionMemo(`LYNX Token Purchase - ${tokenSymbol} Transfer`)
          .setMaxTransactionFee(new Hbar(2));

        // Execute transaction
        const txResponse = await transferTx.execute(this.client);
        
        // Wait for receipt
        const receipt = await txResponse.getReceipt(this.client);
        
        if (receipt.status !== Status.Success) {
          throw new Error(`Transaction failed with status: ${receipt.status}`);
        }

        console.log(`[TokenPurchaseService] ${tokenSymbol} transfer successful:`, txResponse.transactionId);
        
        results.push({
          success: true,
          txId: txResponse.transactionId.toString(),
          token: tokenSymbol
        });

      } catch (error) {
        console.error(`[TokenPurchaseService] ${tokenSymbol} transfer failed:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          token: tokenSymbol
        });
      }
    }

    return results;
  }

  /**
   * Associate tokens with user account using wallet connector
   */
  public async associateTokensWithUser(
    tokenSymbols: string[],
    userAccountId: string,
    connector: DAppConnector
  ): Promise<{ success: boolean; txId?: string; error?: string; associatedTokens?: string[] }> {
    try {
      const associatedTokens: string[] = [];
      const errors: string[] = [];
      
      // Token ID mapping
      const tokenIds: { [key: string]: string } = {
        WBTC: process.env.NEXT_PUBLIC_WBTC_TOKEN_ID || '0.0.6212930',
        SAUCE: process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID || '0.0.1183558',
        USDC: process.env.NEXT_PUBLIC_USDC_TOKEN_ID || '0.0.6212931',
        JAM: process.env.NEXT_PUBLIC_JAM_TOKEN_ID || '0.0.6212932',
        HEADSTART: process.env.NEXT_PUBLIC_HEADSTART_TOKEN_ID || '0.0.6212933'
      };

      // Associate each token one by one
      for (const tokenSymbol of tokenSymbols) {
        const tokenId = tokenIds[tokenSymbol];
        if (!tokenId) {
          errors.push(`No token ID configured for ${tokenSymbol}`);
          continue;
        }

        try {
          console.log(`[TokenPurchaseService] Associating ${tokenSymbol} (${tokenId}) with ${userAccountId}`);

          // Create token associate transaction
          const associateTx = new TokenAssociateTransaction()
            .setAccountId(AccountId.fromString(userAccountId))
            .setTokenIds([TokenId.fromString(tokenId)])
            .setTransactionId(TransactionId.generate(AccountId.fromString(userAccountId)))
            .setTransactionMemo(`LYNX Token Purchase - Associate ${tokenSymbol}`)
            .setMaxTransactionFee(new Hbar(2))
            .freezeWith(this.client);

          // Convert transaction to base64 string
          const txBase64 = transactionToBase64String(associateTx);

          // Execute transaction through wallet connector
          const response = await connector.signAndExecuteTransaction({
            signerAccountId: userAccountId,
            transactionList: txBase64
          });

          console.log(`[TokenPurchaseService] ${tokenSymbol} association successful:`, response);
          associatedTokens.push(tokenSymbol);

        } catch (error) {
          console.error(`[TokenPurchaseService] ${tokenSymbol} association failed:`, error);
          
          // Check if it's already associated
          if (error instanceof Error && error.message.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
            console.log(`[TokenPurchaseService] ${tokenSymbol} is already associated`);
            associatedTokens.push(tokenSymbol);
          } else {
            errors.push(`${tokenSymbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          error: `Failed to associate some tokens: ${errors.join(', ')}`,
          associatedTokens
        };
      }

      return {
        success: true,
        txId: 'multiple',
        associatedTokens
      };

    } catch (error) {
      console.error('[TokenPurchaseService] Token association failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Check if operator has sufficient token balances
   */
  public async checkOperatorBalances(
    tokenAmounts: TokenPurchaseRequest['tokenAmounts']
  ): Promise<{ sufficient: boolean; insufficientTokens: string[] }> {
    try {
      const insufficientTokens: string[] = [];
      
      // Token ID and decimal mapping
      const tokenConfig: { [key: string]: { id: string; decimals: number } } = {
        WBTC: { id: process.env.NEXT_PUBLIC_WBTC_TOKEN_ID || '0.0.6212930', decimals: 8 },
        SAUCE: { id: process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID || '0.0.1183558', decimals: 6 },
        USDC: { id: process.env.NEXT_PUBLIC_USDC_TOKEN_ID || '0.0.6212931', decimals: 6 },
        JAM: { id: process.env.NEXT_PUBLIC_JAM_TOKEN_ID || '0.0.6212932', decimals: 8 },
        HEADSTART: { id: process.env.NEXT_PUBLIC_HEADSTART_TOKEN_ID || '0.0.6212933', decimals: 8 }
      };

      // Check each token balance
      for (const [tokenSymbol, tokenData] of Object.entries(tokenAmounts)) {
        const tokenConfigItem = tokenConfig[tokenSymbol];
        if (!tokenConfigItem) continue;

        const rawBalance = await this.getTokenBalance(tokenConfigItem.id, this.operatorId);
        const requiredRawAmount = Math.floor(tokenData.amount * Math.pow(10, tokenConfigItem.decimals));
        
        if (rawBalance < requiredRawAmount) {
          insufficientTokens.push(tokenSymbol);
        }
      }

      return {
        sufficient: insufficientTokens.length === 0,
        insufficientTokens
      };

    } catch (error) {
      console.error('[TokenPurchaseService] Error checking operator balances:', error);
      return {
        sufficient: false,
        insufficientTokens: Object.keys(tokenAmounts)
      };
    }
  }

  /**
   * Get token balance for a specific account
   */
  private async getTokenBalance(tokenId: string, accountId: string): Promise<number> {
    try {
      const query = new AccountBalanceQuery()
        .setAccountId(accountId);
      
      const balance = await query.execute(this.client);
      const tokenBalance = balance.tokens?.get(TokenId.fromString(tokenId));
      
      return tokenBalance ? Number(tokenBalance) : 0;
    } catch (error) {
      console.error(`[TokenPurchaseService] Error getting token balance for ${tokenId}:`, error);
      return 0;
    }
  }

  /**
   * Close the client connection
   */
  public close(): void {
    this.client.close();
  }
} 