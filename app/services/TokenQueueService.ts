import { v4 as uuid } from 'uuid';
import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { TransactionQueueManager, QueuedTransaction, QueueStats, TransactionResult } from './TransactionQueueManager';
import { TransactionService } from './transactionService';

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

export interface TokenConfig {
  tokenId: string;
  contractId: string;
  delay: number;
  maxRetries: number;
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
  public getTokenConfig(tokenType: string): TokenConfig | null {
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
    const handleSuccess = (result: { txId?: string; transactionId?: string }) => {
      console.log(`[TRACE] ${tokenType} approval completed successfully:`, result);
      onSuccess?.(result.txId || result.transactionId || 'unknown');
    };
    
    const handleError = (error: Error) => {
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
          // Convert TransactionResponse to TransactionResult
          return {
            txId: result.txId,
            transactionId: result.txId,
            status: result.status
          } as TransactionResult;
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
    
    // Calculate required token amounts based on LYNX amount (with proper decimals)
    // SAUCE and CLXY have 6 decimals, so we need to multiply by 10^6 for base units
    const sauceAmount = (lynxAmount * this.getTokenRatios().sauceRatio * Math.pow(10, 6)).toString();
    const clxyAmount = (lynxAmount * this.getTokenRatios().clxyRatio * Math.pow(10, 6)).toString();
    
    try {
      console.log(`[QUEUE DEBUG] Starting LYNX minting process for ${lynxAmount} LYNX (requires ${sauceAmount} SAUCE and ${clxyAmount} CLXY)`);
      
      // Check if contract has supply key
      const hasSupplyKey = await this.transactionService.checkSupplyKey(TOKEN_CONFIG.LYNX.contractId);
      if (!hasSupplyKey) {
        throw new Error('Contract does not have supply key for LYNX token');
      }

      // OPTIMIZED: Check token associations efficiently
      console.log('[QUEUE DEBUG] Checking token associations...');
      
      // First, try to get current balances - if tokens have balances, they're already associated
      let tokensNeedingAssociation: string[] = [];
      
      try {
        // Use the balance service to check if tokens are associated (faster than individual checks)
        const { BalanceService } = await import('../services/balanceService');
        const balanceService = new BalanceService();
        const balances = await balanceService.getTokenBalances(this.accountId);
        
        console.log('[QUEUE DEBUG] Current token balances:', balances);
        
        // If a token has a balance (even 0), it's associated
        // If balance query fails or returns undefined, token needs association
        const tokenChecks = [
          { name: 'SAUCE', id: TOKEN_CONFIG.SAUCE.tokenId, balance: balances.SAUCE },
          { name: 'CLXY', id: TOKEN_CONFIG.CLXY.tokenId, balance: balances.CLXY },
          { name: 'LYNX', id: TOKEN_CONFIG.LYNX.tokenId, balance: balances.LYNX }
        ];
        
        for (const token of tokenChecks) {
          if (token.balance === undefined || token.balance === null) {
            console.log(`[QUEUE DEBUG] ${token.name} token needs association (no balance data)`);
            tokensNeedingAssociation.push(token.id);
          } else {
            console.log(`[QUEUE DEBUG] ${token.name} token already associated (balance: ${token.balance})`);
          }
        }
        
        balanceService.close();
      } catch (error) {
        console.warn('[QUEUE DEBUG] Could not check balances for association status, falling back to individual checks:', error);
        // Fallback: assume all tokens need association check
        tokensNeedingAssociation = [TOKEN_CONFIG.SAUCE.tokenId, TOKEN_CONFIG.CLXY.tokenId, TOKEN_CONFIG.LYNX.tokenId];
      }
      
      // Only associate tokens that actually need it
      if (tokensNeedingAssociation.length === 0) {
        console.log('[QUEUE DEBUG] All tokens already associated, skipping association step');
      } else {
        console.log(`[QUEUE DEBUG] Need to associate ${tokensNeedingAssociation.length} tokens:`, tokensNeedingAssociation);
        
        for (const tokenId of tokensNeedingAssociation) {
          try {
            const tokenName = tokenId === TOKEN_CONFIG.SAUCE.tokenId ? 'SAUCE' :
                             tokenId === TOKEN_CONFIG.CLXY.tokenId ? 'CLXY' : 'LYNX';
                             
            console.log(`[QUEUE DEBUG] Associating ${tokenName} token...`);
            const result = await this.transactionService.associateToken(tokenId, this.accountId);
            
            if (!result.success) {
              throw new Error(`${tokenName} token association failed: ${result.message}`);
            }
            
            console.log(`[QUEUE DEBUG] ${tokenName} token associated successfully`);
          } catch (error) {
            console.error(`[QUEUE DEBUG] Error associating token ${tokenId}:`, error);
            throw new Error(`Token association failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
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
          
          console.log(`[QUEUE DEBUG] Both approvals completed successfully, executing mint`);
          
          // Execute the mint transaction
          const mintResult = await this.transactionService!.mintLynx(lynxAmount);
          
          if (mintResult.status === 'error') {
            console.error(`[QUEUE DEBUG] Minting failed:`, mintResult.error);
            throw mintResult.error || new Error('LYNX minting failed');
          }
          
          console.log(`[QUEUE DEBUG] LYNX minting completed successfully`);
          // Convert TransactionResponse to TransactionResult
          return {
            txId: mintResult.txId || 'unknown',
            transactionId: mintResult.txId || 'unknown',
            status: mintResult.status
          } as TransactionResult;
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
      hbarRatio: 10,    // 10 HBAR per LYNX
      sauceRatio: 5,    // 5 SAUCE per LYNX (matches contract)
      clxyRatio: 2      // 2 CLXY per LYNX (matches contract)
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