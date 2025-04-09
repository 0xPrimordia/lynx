import { v4 as uuid } from 'uuid';
import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { TransactionQueueManager, QueuedTransaction, QueueStats } from './TransactionQueueManager';
import { TransactionService } from './transactionService';
import { checkTokenAssociation, associateToken } from '../actions/tokenActions';
import { TOKEN_IDS, CONTRACT_IDS } from '../config/environment';

// Token configuration
const TOKEN_CONFIG = {
  SAUCE: {
    tokenId: TOKEN_IDS.SAUCE,
    contractId: CONTRACT_IDS.LYNX, // Using the same contract for all tokens
    delay: 500,
    maxRetries: 2
  },
  CLXY: {
    tokenId: TOKEN_IDS.CLXY,
    contractId: CONTRACT_IDS.LYNX, // Using the same contract for all tokens
    delay: 500,
    maxRetries: 2
  },
  LYNX: {
    tokenId: TOKEN_IDS.LYNX,
    contractId: CONTRACT_IDS.LYNX,
    delay: 500,
    maxRetries: 1
  }
};

export interface TokenApprovalParams {
  tokenType: 'SAUCE' | 'CLXY' | 'LYNX';
  tokenName: string;
  tokenId: string;
  contractId: string;
  amount: string;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: Error) => void;
}

export interface MintParams {
  lynxAmount: number;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: Error) => void;
}

export interface MintLynxResult {
  sauceApprovalId: string;
  clxyApprovalId: string;
  mintId: string;
}

/**
 * Token Queue Service
 * 
 * Manages token approvals and minting operations using the TransactionQueueManager
 * to ensure sequential processing and avoid wallet popup conflicts.
 */
export class TokenQueueService {
  private queueManager: TransactionQueueManager;
  private connector: DAppConnector | null = null;
  private accountId: string | null = null;
  private transactionService: TransactionService | null = null;
  
  constructor() {
    this.queueManager = new TransactionQueueManager({
      defaultDelayMs: 1000, // Increase delay between transactions for better UX
      defaultMaxRetries: 2
    });
  }
  
  /**
   * Update the wallet connection
   */
  public updateConnection(connector: DAppConnector | null, accountId: string | null): void {
    this.connector = connector;
    this.accountId = accountId;
    this.queueManager.updateConnection(connector, accountId);
    
    if (connector && accountId) {
      this.transactionService = new TransactionService(connector);
      this.transactionService.updateConnection(connector, accountId);
    } else {
      this.transactionService = null;
    }
  }
  
  /**
   * Get token configuration by token type/name
   */
  public getTokenConfig(tokenType: string): any {
    const type = tokenType.toUpperCase() as keyof typeof TOKEN_CONFIG;
    return TOKEN_CONFIG[type] || null;
  }
  
  /**
   * Queue a token approval transaction
   */
  public queueTokenApproval(params: TokenApprovalParams): Promise<string> {
    if (!this.connector || !this.accountId || !this.transactionService) {
      return Promise.reject(new Error('Wallet not connected'));
    }
    
    const { tokenType, amount, onSuccess, onError } = params;
    
    // Use config or provided values
    const tokenId = params.tokenId || TOKEN_CONFIG[tokenType].tokenId;
    const contractId = params.contractId || TOKEN_CONFIG[tokenType].contractId;
    const tokenName = params.tokenName || tokenType;
    
    // Create a unique ID for this transaction
    const transactionId = `${tokenType.toLowerCase()}-approval-${uuid().slice(0, 8)}`;
    
    console.log(`[TRACE] Starting token approval queue process`, {
      tokenType,
      amount,
      tokenId,
      contractId,
      queuedTxId: transactionId
    });
    
    // Define success and error callbacks
    const handleSuccess = (result: any) => {
      console.log(`[TRACE] ${tokenType} approval completed successfully:`, result);
      onSuccess?.(result.txId || result.transactionId || 'unknown');
    };
    
    const handleError = (error: any) => {
      console.error(`[TRACE] ${tokenType} approval failed:`, error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    };
    
    // Enqueue the transaction
    this.queueManager.enqueue({
      id: transactionId,
      name: `${tokenName} Approval`,
      tokenName: tokenName,
      createTransaction: async () => {
        console.log(`[TRACE] Creating REAL ${tokenType} approval transaction for ${amount}`);
        
        // Use the transaction service to create and execute the approval
        try {
          console.log(`[TRACE] Calling TransactionService.approveToken`);
          const result = await this.transactionService!.approveToken({
            tokenId,
            contractId,
            amount: amount,
            tokenName: tokenName
          });
          
          console.log(`[TRACE] TransactionService.approveToken returned:`, {
            status: result.status,
            txId: result.txId,
            hasError: !!result.error
          });
          
          if (result.status === 'error') {
            console.error(`[TRACE] ${tokenName} approval transaction failed:`, result.error);
            throw result.error || new Error(`${tokenName} approval failed`);
          }
          
          console.log(`[TRACE] ${tokenName} approval transaction completed successfully`);
          return result;
        } catch (error) {
          console.error(`[TRACE] Exception in TransactionService.approveToken:`, error);
          throw error;
        }
      },
      onSuccess: handleSuccess,
      onError: handleError,
      delayMs: TOKEN_CONFIG[tokenType].delay,
      maxRetries: TOKEN_CONFIG[tokenType].maxRetries
    });
    
    console.log(`[TRACE] Transaction ${transactionId} successfully added to queue`);
    return Promise.resolve(transactionId);
  }
  
  /**
   * Queue a LYNX minting operation, including necessary token approvals
   */
  public async queueMintLynx(params: MintParams): Promise<MintLynxResult> {
    if (!this.connector || !this.accountId || !this.transactionService) {
      return Promise.reject(new Error('Wallet not connected'));
    }
    
    const { lynxAmount, onSuccess, onError } = params;
    
    // Calculate required token amounts based on LYNX amount
    const sauceAmount = (lynxAmount * this.getTokenRatios().sauceRatio).toString();
    const clxyAmount = (lynxAmount * this.getTokenRatios().clxyRatio).toString();
    
    try {
      console.log(`[QUEUE DEBUG] Starting LYNX minting process for ${lynxAmount} LYNX (requires ${sauceAmount} SAUCE and ${clxyAmount} CLXY)`);
      
      // Check if contract has supply key
      const hasSupplyKey = await this.transactionService.checkSupplyKey(TOKEN_CONFIG.LYNX.contractId);
      if (!hasSupplyKey) {
        throw new Error('Contract does not have supply key for LYNX token');
      }

      // NOTE: For testnet account 0.0.4372449, we're skipping association checks since tokens are already associated
      if (this.accountId === '0.0.4372449') {
        console.log('[QUEUE DEBUG] Using testnet account with pre-associated tokens, skipping association checks');
      } else {
        console.log('[QUEUE DEBUG] Checking token associations for non-testnet account...');
        
        // Check LYNX token association
        let lynxAssociated = false;
        try {
          lynxAssociated = await checkTokenAssociation(TOKEN_CONFIG.LYNX.tokenId, this.accountId);
          console.log(`[QUEUE DEBUG] LYNX token association status: ${lynxAssociated ? 'Associated' : 'Not Associated'}`);
          
          if (!lynxAssociated && this.transactionService) {
            console.log('[QUEUE DEBUG] LYNX token needs to be associated');
            const lynxResult = await this.transactionService.associateToken(TOKEN_CONFIG.LYNX.tokenId, this.accountId);
            if (!lynxResult.success) {
              throw new Error(`LYNX token association failed: ${lynxResult.message}`);
            }
          }
        } catch (error) {
          console.error('[QUEUE DEBUG] Error checking/associating LYNX token:', error);
          throw new Error(`Error with LYNX token: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Check SAUCE token association
        let sauceAssociated = false;
        try {
          sauceAssociated = await checkTokenAssociation(TOKEN_CONFIG.SAUCE.tokenId, this.accountId);
          console.log(`[QUEUE DEBUG] SAUCE token association status: ${sauceAssociated ? 'Associated' : 'Not Associated'}`);
          
          if (!sauceAssociated && this.transactionService) {
            console.log('[QUEUE DEBUG] SAUCE token needs to be associated');
            const sauceResult = await this.transactionService.associateToken(TOKEN_CONFIG.SAUCE.tokenId, this.accountId);
            if (!sauceResult.success) {
              throw new Error(`SAUCE token association failed: ${sauceResult.message}`);
            }
          }
        } catch (error) {
          console.error('[QUEUE DEBUG] Error checking/associating SAUCE token:', error);
          throw new Error(`Error with SAUCE token: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Check CLXY token association
        let clxyAssociated = false;
        try {
          clxyAssociated = await checkTokenAssociation(TOKEN_CONFIG.CLXY.tokenId, this.accountId);
          console.log(`[QUEUE DEBUG] CLXY token association status: ${clxyAssociated ? 'Associated' : 'Not Associated'}`);
          
          if (!clxyAssociated && this.transactionService) {
            console.log('[QUEUE DEBUG] CLXY token needs to be associated');
            const clxyResult = await this.transactionService.associateToken(TOKEN_CONFIG.CLXY.tokenId, this.accountId);
            if (!clxyResult.success) {
              throw new Error(`CLXY token association failed: ${clxyResult.message}`);
            }
          }
        } catch (error) {
          console.error('[QUEUE DEBUG] Error checking/associating CLXY token:', error);
          throw new Error(`Error with CLXY token: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        console.log('[QUEUE DEBUG] Token association checks/operations completed');
      }
      
      console.log('[QUEUE DEBUG] Proceeding with token approvals');
      
      // Queue SAUCE approval first
      const sauceApprovalId = await this.queueTokenApproval({
        tokenType: 'SAUCE',
        tokenName: 'SAUCE',
        tokenId: TOKEN_CONFIG.SAUCE.tokenId,
        contractId: TOKEN_CONFIG.SAUCE.contractId,
        amount: sauceAmount
      });
      
      console.log(`[QUEUE DEBUG] SAUCE approval queued with ID: ${sauceApprovalId}`);
      
      // Queue CLXY approval next
      const clxyApprovalId = await this.queueTokenApproval({
        tokenType: 'CLXY',
        tokenName: 'CLXY',
        tokenId: TOKEN_CONFIG.CLXY.tokenId,
        contractId: TOKEN_CONFIG.CLXY.contractId,
        amount: clxyAmount
      });
      
      console.log(`[QUEUE DEBUG] CLXY approval queued with ID: ${clxyApprovalId}`);
      
      // Create a unique ID for the mint transaction
      const mintTxId = `mint-lynx-${uuid().slice(0, 8)}`;
      
      // Queue the mint transaction after approvals
      this.queueManager.enqueue({
        id: mintTxId,
        name: `Mint ${lynxAmount} LYNX`,
        createTransaction: async () => {
          // Check that both approvals completed successfully
          console.log(`[QUEUE DEBUG] Verifying approval transactions before minting...`);
          
          const sauceApproval = this.queueManager.getTransaction(sauceApprovalId);
          if (!sauceApproval) {
            console.error(`[QUEUE DEBUG] SAUCE approval transaction not found`);
            throw new Error('SAUCE approval transaction not found');
          }
          
          if (sauceApproval.status !== 'completed') {
            console.error(`[QUEUE DEBUG] SAUCE approval status: ${sauceApproval.status}`);
            throw new Error(`SAUCE approval not completed - status: ${sauceApproval.status}`);
          }
          
          const clxyApproval = this.queueManager.getTransaction(clxyApprovalId);
          if (!clxyApproval) {
            console.error(`[QUEUE DEBUG] CLXY approval transaction not found`);
            throw new Error('CLXY approval transaction not found');
          }
          
          if (clxyApproval.status !== 'completed') {
            console.error(`[QUEUE DEBUG] CLXY approval status: ${clxyApproval.status}`);
            throw new Error(`CLXY approval not completed - status: ${clxyApproval.status}`);
          }
          
          console.log(`[QUEUE DEBUG] Approvals verified, proceeding with REAL LYNX mint transaction...`);
          
          // Use the transaction service to create and execute the mint
          const result = await this.transactionService!.mintLynx(lynxAmount);
          
          if (result.status === 'error') {
            console.error(`[QUEUE DEBUG] LYNX mint transaction failed:`, result.error);
            throw result.error || new Error('LYNX mint failed');
          }
          
          console.log(`[QUEUE DEBUG] LYNX mint transaction completed:`, result);
          return result;
        },
        onSuccess: (result) => {
          console.log(`[QUEUE DEBUG] Mint of ${lynxAmount} LYNX successful:`, result);
          onSuccess?.(result.txId || result.transactionId || 'unknown');
        },
        onError: (error) => {
          console.error(`[QUEUE DEBUG] Mint of ${lynxAmount} LYNX failed:`, error);
          onError?.(error instanceof Error ? error : new Error(String(error)));
        },
        delayMs: TOKEN_CONFIG.LYNX.delay,
        maxRetries: TOKEN_CONFIG.LYNX.maxRetries
      });
      
      console.log(`[QUEUE DEBUG] LYNX mint transaction queued with ID: ${mintTxId}`);
      
      return {
        sauceApprovalId,
        clxyApprovalId,
        mintId: mintTxId
      };
    } catch (error) {
      console.error('[QUEUE DEBUG] Error queueing mint operation:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  /**
   * Get current stats about the transaction queue
   */
  public getQueueStats(): QueueStats {
    return this.queueManager.getStats();
  }
  
  /**
   * Get a transaction by ID
   */
  public getTransaction(id: string): QueuedTransaction | undefined {
    return this.queueManager.getTransaction(id);
  }
  
  /**
   * Get token ratios for calculating required tokens
   */
  public getTokenRatios(): { hbarRatio: number; sauceRatio: number; clxyRatio: number; } {
    return {
      hbarRatio: 10,    // 10 tinybar per LYNX
      sauceRatio: 100,  // 100 SAUCE per LYNX
      clxyRatio: 50     // 50 CLXY per LYNX
    };
  }
  
  /**
   * Calculate required HBAR for minting
   */
  public calculateRequiredHBAR(lynxAmount: number): number {
    // 10 tinybar per LYNX = 0.0000001 HBAR per LYNX
    return lynxAmount * 0.0000001;
  }
} 