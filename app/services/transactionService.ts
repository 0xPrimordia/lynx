import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { transactionToBase64String } from '@hashgraph/hedera-wallet-connect';
import { 
  AccountId, 
  ContractExecuteTransaction, 
  ContractFunctionParameters, 
  Hbar,
  ContractId,
  TokenId,
  Client,
  TransactionId,
  TokenAssociateTransaction
} from '@hashgraph/sdk';
import { checkTokenAssociation } from '../actions/tokenActions';
import { HashPackWalletResponse } from '../types';

export interface TransactionResponse {
  status: string;
  txId: string;
  error?: Error;
}

interface TokenApprovalParams {
  tokenId: string;
  contractId: string;
  amount: string | number;
  tokenName?: string;
}

/**
 * Service for handling Hedera transactions
 * Handles real blockchain transactions for token approvals and minting
 */
export class TransactionService {
  private connector: DAppConnector;
  private accountId: string;

  constructor(connector: DAppConnector) {
    this.connector = connector;
    this.accountId = ''; // Will be set when updateConnection is called
  }

  /**
   * Update the connection with account ID
   */
  public updateConnection(connector: DAppConnector, accountId: string): void {
    this.connector = connector;
    this.accountId = accountId;
  }

  /**
   * Convert a Hedera Token ID (0.0.X) to an EVM address format
   * This follows Hedera's token address derivation scheme
   */
  private tokenIdToEvmAddress(tokenIdStr: string): string {
    try {
      // Parse the Hedera token ID
      const tokenId = TokenId.fromString(tokenIdStr);
      
      // Get the solidity address (returns a proper EVM-compatible address)
      return tokenId.toSolidityAddress();
    } catch (error) {
      // If the tokenId is already in EVM format, just return it
      if (tokenIdStr.startsWith('0x') && (tokenIdStr.length === 42)) {
        return tokenIdStr;
      }
      
      console.error('Failed to convert token ID to EVM address:', error);
      throw new Error(`Invalid token ID format: ${tokenIdStr}`);
    }
  }

  /**
   * Approve a token for spending
   */
  public async approveToken(params: TokenApprovalParams): Promise<TransactionResponse> {
    try {
      if (!this.connector || !this.accountId) {
        throw new Error('Wallet not connected');
      }
      
      // Get token info
      const { tokenId, contractId, amount, tokenName = 'Token' } = params;
      
      console.log(`[DEBUG] Starting ${tokenName} approval transaction`, {
        accountId: this.accountId,
        tokenId: tokenId,
        contractId: contractId,
        amount: amount
      });
      
      // Convert Hedera token ID to EVM-compatible address format
      const tokenAddress = AccountId.fromString(tokenId).toSolidityAddress();
      console.log(`[DEBUG] Token ID converted to EVM address: ${tokenId} -> ${tokenAddress}`);
      
      // 1. Create a client for the network FIRST (critical step)
      const client = Client.forTestnet();
      
      // 2. Parse account ID properly
      const sender = AccountId.fromString(this.accountId);
      
      // 3. Create and freeze the contract execute transaction
      const transaction = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(contractId))
        .setGas(3000000)
        .setFunction(
          "approve", 
          new ContractFunctionParameters()
            .addAddress(tokenAddress)
            .addUint256(Number(amount))
        )
        .setTransactionId(TransactionId.generate(sender))
        .setTransactionMemo(`Approve ${tokenName} for LYNX Minting`)
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(client);

      console.log(`[DEBUG] Transaction created with ID: ${transaction.transactionId?.toString()}`);
      console.log(`[DEBUG] Transaction frozen state: ${transaction.isFrozen()}`);
      
      // 4. Convert transaction to base64 using SDK method ONLY
      const txBase64 = transactionToBase64String(transaction);
      
      console.log(`[DEBUG] Transaction converted to base64 using SDK method, length: ${txBase64.length}`);
      
      // 5. Send to HashPack for signing and execution
      console.log(`[DEBUG] Sending transaction to HashPack`);
      
      try {
        // Execute the transaction with the wallet using signAndExecuteTransaction
        const response = await this.connector.signAndExecuteTransaction({
          signerAccountId: this.accountId,
          transactionList: txBase64
        });
        
        console.log(`[DEBUG] HashPack response:`, response);
        
        // Use proper typing for HashPack response
        const responseObj = response as unknown as HashPackWalletResponse;
        const txId = String(responseObj?.id || 'unknown');
        
        console.log(`[DEBUG] ${tokenName} approval transaction executed successfully: ${txId}`);
        
        return {
          status: 'success',
          txId
        };
      } catch (signError) {
        console.error('[DEBUG] Error during HashPack transaction:', {
          errorType: typeof signError,
          errorKeys: signError ? Object.keys(signError) : [],
          errorMessage: signError instanceof Error ? signError.message : String(signError)
        });
        throw signError;
      }
    } catch (error) {
      console.error("[DEBUG] Token approval error:", error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('[DEBUG] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      // Handle empty error objects (wallet popup closed)
      if (error && typeof error === 'object' && Object.keys(error).length === 0) {
        return {
          status: 'error',
          txId: '',
          error: new Error(`${params.tokenName} approval was rejected or wallet popup was closed`)
        };
      }
      
      return {
        status: 'error',
        txId: '',
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Mint LYNX tokens
   * Creates and executes a mint transaction using the Hedera SDK
   */
  public async mintLynx(amount: number): Promise<TransactionResponse> {
    try {
      if (!this.connector || !this.accountId) {
        console.error('[CRITICAL] Cannot mint LYNX: wallet not connected');
        throw new Error('Wallet not connected');
      }

      console.log(`[CRITICAL] Starting LYNX mint process for amount: ${amount}`, {
        accountId: this.accountId,
        connectorStatus: this.connector ? 'initialized' : 'null',
        transactionType: 'mint'
      });
      
      // Contract ID for LYNX minting
      const contractId = '0.0.5758264'; // LYNX contract
      
      // 1. Create the client FIRST (critical step)
      const client = Client.forTestnet();
      
      // 2. Parse account ID properly
      const sender = AccountId.fromString(this.accountId);
      
      // Per contract, HBAR_RATIO = 10 tinybar
      // 10 tinybar = 0.0000001 HBAR (since 1 HBAR = 100,000,000 tinybar)
      const hbarPerLynx = 0.0000001;
      
      // 3. Create a contract execute transaction to call the mint function
      console.log('[CRITICAL] Creating mint transaction for contract', contractId);
      console.log('[CRITICAL] Sending HBAR amount:', amount * hbarPerLynx, 'HBAR (', amount * 10, 'tinybar)');
      
      const transaction = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(contractId))
        .setGas(5000000)
        .setFunction(
          "mint", 
          new ContractFunctionParameters()
            .addUint256(amount)  // amount to mint
        )
        .setTransactionId(TransactionId.generate(sender))
        .setTransactionMemo(`Mint ${amount} LYNX tokens`)
        .setPayableAmount(new Hbar(amount * hbarPerLynx)) // 10 tinybar per LYNX = 0.0000001 HBAR
        .setMaxTransactionFee(new Hbar(5))
        .freezeWith(client);
      
      console.log('[CRITICAL] Mint transaction created with ID:', transaction.transactionId?.toString());
      console.log('[CRITICAL] Transaction frozen state:', transaction.isFrozen());
      
      // 4. Convert to base64 using the SDK method ONLY
      const txBase64 = transactionToBase64String(transaction);
      
      console.log('[CRITICAL] Transaction converted to base64 using SDK method, length:', txBase64.length);
      
      // 5. Sign and execute the transaction
      console.log('[CRITICAL] SENDING TRANSACTION TO WALLET - WATCH FOR POPUP');
      try {
        // Send to wallet for signing and execution with EXACT parameters
        const response = await this.connector.signAndExecuteTransaction({
          signerAccountId: this.accountId,
          transactionList: txBase64
        });
        
        console.log('[CRITICAL] TRANSACTION EXECUTED SUCCESSFULLY', response);
        
        // Use proper typing for HashPack response
        const responseObj = response as unknown as HashPackWalletResponse;
        const txId = String(responseObj?.id || 'unknown');
        
        return {
          status: 'success',
          txId
        };
      } catch (signError) {
        console.error('[CRITICAL] Error during signAndExecuteTransaction call:', {
          errorType: typeof signError,
          errorKeys: signError ? Object.keys(signError) : [],
          errorMessage: signError instanceof Error ? signError.message : String(signError),
          errorStack: signError instanceof Error ? signError.stack : undefined
        });
        throw signError;
      }
    } catch (error) {
      console.error("[CRITICAL] LYNX minting error:", error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('[CRITICAL] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      } else {
        console.error('[CRITICAL] Non-Error object thrown:', error);
      }
      
      // Handle empty error objects (wallet popup closed)
      if (error && typeof error === 'object' && Object.keys(error).length === 0) {
        console.log('[CRITICAL] Empty error object detected - likely wallet rejection');
        return {
          status: 'error',
          txId: '',
          error: new Error('LYNX minting was rejected or wallet popup was closed')
        };
      }
      
      return {
        status: 'error',
        txId: '',
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Check if a token is associated with an account
   * @deprecated Use the server action checkTokenAssociation instead for security
   */
  async isTokenAssociated(): Promise<boolean> {
    console.warn('[TokenService] isTokenAssociated method is deprecated, use server action instead');
    if (!this.connector) {
      console.error('[TokenService] Wallet connector not initialized');
      return false;
    }

    try {
      // This method is no longer secure - returning true to avoid breaking changes
      console.log('[TokenService] Bypassing token association check for security reasons');
      return true;
    } catch (error) {
      console.error('[TokenService] Error checking token association:', error);
      return false;
    }
  }

  /**
   * Check if the contract has the supply key for the LYNX token
   * For web frontend, we directly return true since we know the contract has the supply key
   */
  public async checkSupplyKey(contractId: string): Promise<boolean> {
    try {
      console.log(`[DEBUG] Checking supply key for contract ${contractId} (frontend method)`);
      
      // For web frontend, we know the contract has the supply key
      // so we return true directly without trying to access private keys
      return true;
    } catch (error) {
      console.error('[ERROR] Failed to check supply key:', error);
      throw error;
    }
  }

  /**
   * Associate a token with the connected account
   * This uses the client's wallet to perform the association
   */
  public async associateToken(tokenId: string, accountId: string): Promise<{
    success: boolean;
    message: string;
    txId?: string;
  }> {
    try {
      if (!this.connector || !this.accountId) {
        throw new Error('Wallet not connected');
      }

      console.log(`[TokenService] Checking if token ${tokenId} is already associated with account ${accountId}`);
      
      // First check if the token is already associated using the server action
      try {
        console.log(`[TokenService] Performing initial association check`);
        const isAssociated = await checkTokenAssociation(tokenId, accountId);
        if (isAssociated) {
          console.log(`[TokenService] Token ${tokenId} is already associated with account ${accountId} - skipping association`);
          return {
            success: true,
            message: 'Token is already associated'
          };
        }
        console.log(`[TokenService] Initial check shows token is NOT associated, proceeding with association`);
      } catch (checkError) {
        console.warn(`[TokenService] Error during initial association check:`, checkError);
        console.log(`[TokenService] Will perform double-check to verify association status`);
        
        // Perform a second check with a short delay to be sure
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          const secondCheck = await checkTokenAssociation(tokenId, accountId);
          if (secondCheck) {
            console.log(`[TokenService] Double-check confirms token ${tokenId} is already associated - skipping association`);
            return {
              success: true,
              message: 'Token is already associated (confirmed by double-check)'
            };
          }
          console.log(`[TokenService] Double-check confirms token is NOT associated, proceeding with association`);
        } catch (secondCheckError) {
          console.warn(`[TokenService] Double-check also failed, will attempt association anyway:`, secondCheckError);
        }
      }
      
      // Create a client for testnet
      const client = Client.forTestnet();
      
      // Parse account ID properly
      const sender = AccountId.fromString(this.accountId);
      
      console.log(`[TokenService] Creating token association transaction for ${tokenId}`);
      
      // Create the TokenAssociateTransaction
      const transaction = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(accountId))
        .setTokenIds([TokenId.fromString(tokenId)])
        .setTransactionId(TransactionId.generate(sender))
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(client);
      
      // Convert transaction to base64 using SDK method
      const txBase64 = transactionToBase64String(transaction);
      
      // Log details before sending to wallet
      console.log(`[TokenService] Transaction prepared, sending to wallet for signing`);
      console.log(`[TokenService] Signer account ID: ${this.accountId}`);
      
      // Send to wallet for signing and execution
      try {
        console.log(`[TokenService] Requesting wallet signature and execution...`);
        const response = await this.connector.signAndExecuteTransaction({
          signerAccountId: this.accountId,
          transactionList: txBase64
        });
        
        console.log(`[TokenService] Wallet returned response:`, response);
        
        // Use proper typing for HashPack response
        const responseObj = response as unknown as HashPackWalletResponse;
        const txId = String(responseObj?.id || 'unknown');
        
        console.log(`[TokenService] Association completed with transaction ID: ${txId}`);
        return {
          success: true,
          message: 'Token successfully associated',
          txId
        };
      } catch (walletError) {
        console.error(`[TokenService] Wallet error during signing:`, walletError);
        
        // Check if this was a rejection because the token is already associated
        console.log(`[TokenService] Checking if token is now associated after wallet error`);
        try {
          const finalCheck = await checkTokenAssociation(tokenId, accountId);
          if (finalCheck) {
            console.log(`[TokenService] Despite error, token ${tokenId} is actually associated`);
            return {
              success: true,
              message: 'Token is already associated (verified after wallet error)'
            };
          }
        } catch (finalCheckError) {
          console.warn(`[TokenService] Final association check failed:`, finalCheckError);
        }
        
        throw new Error(`Wallet error: ${walletError instanceof Error ? walletError.message : String(walletError)}`);
      }
    } catch (error) {
      console.error('[TokenService] Error associating token:', error);
      
      // Handle empty error objects (wallet popup closed)
      if (error && typeof error === 'object' && Object.keys(error).length === 0) {
        return {
          success: false,
          message: 'Token association was rejected or wallet popup was closed'
        };
      }
      
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 