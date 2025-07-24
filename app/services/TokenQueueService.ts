import { v4 as uuid } from 'uuid';
import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { TransactionQueueManager, QueuedTransaction, QueueStats, TransactionResult } from './TransactionQueueManager';
import { TransactionService } from './transactionService';

import { TOKEN_IDS, CONTRACT_IDS } from '../config/environment';

// Token configuration for 6-token system
const TOKEN_CONFIG = {
  WBTC: {
    tokenId: TOKEN_IDS.WBTC,
    contractId: CONTRACT_IDS.DEPOSIT_MINTER_V2, // Using DepositMinterV2 contract
    delay: 500,
    maxRetries: 2
  },
  SAUCE: {
    tokenId: TOKEN_IDS.SAUCE,
    contractId: CONTRACT_IDS.DEPOSIT_MINTER_V2, // Using DepositMinterV2 contract
    delay: 500,
    maxRetries: 2
  },
  USDC: {
    tokenId: TOKEN_IDS.USDC,
    contractId: CONTRACT_IDS.DEPOSIT_MINTER_V2, // Using DepositMinterV2 contract
    delay: 500,
    maxRetries: 2
  },
  JAM: {
    tokenId: TOKEN_IDS.JAM,
    contractId: CONTRACT_IDS.DEPOSIT_MINTER_V2, // Using DepositMinterV2 contract
    delay: 500,
    maxRetries: 2
  },
  HEADSTART: {
    tokenId: TOKEN_IDS.HEADSTART,
    contractId: CONTRACT_IDS.DEPOSIT_MINTER_V2, // Using DepositMinterV2 contract
    delay: 500,
    maxRetries: 2
  },
  LYNX: {
    tokenId: TOKEN_IDS.LYNX,
    contractId: CONTRACT_IDS.DEPOSIT_MINTER_V2,
    delay: 500,
    maxRetries: 1
  }
};

export interface TokenApprovalParams {
  tokenType: 'WBTC' | 'SAUCE' | 'USDC' | 'JAM' | 'HEADSTART' | 'LYNX';
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
  wbtcApprovalId: string;
  sauceApprovalId: string;
  usdcApprovalId: string;
  jamApprovalId: string;
  headstartApprovalId: string;
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
    
    // Calculate required token amounts for 6-token system (using DepositMinterV2 ratios)
    const ratios = this.getTokenRatios();
    
    const wbtcAmount = (lynxAmount * ratios.wbtcRatio * Math.pow(10, 8)).toString(); // 8 decimals
    const sauceAmount = (lynxAmount * ratios.sauceRatio * Math.pow(10, 6)).toString(); // 6 decimals
    const usdcAmount = (lynxAmount * ratios.usdcRatio * Math.pow(10, 6)).toString(); // 6 decimals
    const jamAmount = (lynxAmount * ratios.jamRatio * Math.pow(10, 8)).toString(); // 8 decimals
    const headstartAmount = (lynxAmount * ratios.headstartRatio * Math.pow(10, 8)).toString(); // 8 decimals
    
    try {
      console.log(`[QUEUE DEBUG] Starting LYNX minting process for ${lynxAmount} LYNX`);
      console.log(`[QUEUE DEBUG] Required amounts: WBTC=${wbtcAmount}, SAUCE=${sauceAmount}, USDC=${usdcAmount}, JAM=${jamAmount}, HEADSTART=${headstartAmount}`);
      
      // Check token associations for all 6 tokens
      console.log('[QUEUE DEBUG] Checking token associations...');
      
      let tokensNeedingAssociation: string[] = [];
      
      try {
        // Use the balance service to check if tokens are associated
        const { BalanceService } = await import('../services/balanceService');
        const balanceService = new BalanceService();
        const balances = await balanceService.getTokenBalances(this.accountId);
        
        console.log('[QUEUE DEBUG] Current token balances:', balances);
        
        // Check all 6 tokens
        const tokenChecks = [
          { name: 'WBTC', id: TOKEN_CONFIG.WBTC.tokenId, balance: balances.WBTC },
          { name: 'SAUCE', id: TOKEN_CONFIG.SAUCE.tokenId, balance: balances.SAUCE },
          { name: 'USDC', id: TOKEN_CONFIG.USDC.tokenId, balance: balances.USDC },
          { name: 'JAM', id: TOKEN_CONFIG.JAM.tokenId, balance: balances.JAM },
          { name: 'HEADSTART', id: TOKEN_CONFIG.HEADSTART.tokenId, balance: balances.HEADSTART },
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
        tokensNeedingAssociation = [
          TOKEN_CONFIG.WBTC.tokenId, 
          TOKEN_CONFIG.SAUCE.tokenId, 
          TOKEN_CONFIG.USDC.tokenId,
          TOKEN_CONFIG.JAM.tokenId,
          TOKEN_CONFIG.HEADSTART.tokenId,
          TOKEN_CONFIG.LYNX.tokenId
        ];
      }
      
      // Associate tokens that need it
      if (tokensNeedingAssociation.length === 0) {
        console.log('[QUEUE DEBUG] All tokens already associated, skipping association step');
      } else {
        console.log(`[QUEUE DEBUG] Need to associate ${tokensNeedingAssociation.length} tokens:`, tokensNeedingAssociation);
        
        for (const tokenId of tokensNeedingAssociation) {
          try {
            const tokenName = tokenId === TOKEN_CONFIG.WBTC.tokenId ? 'WBTC' :
                             tokenId === TOKEN_CONFIG.SAUCE.tokenId ? 'SAUCE' :
                             tokenId === TOKEN_CONFIG.USDC.tokenId ? 'USDC' :
                             tokenId === TOKEN_CONFIG.JAM.tokenId ? 'JAM' :
                             tokenId === TOKEN_CONFIG.HEADSTART.tokenId ? 'HEADSTART' : 'LYNX';
                             
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
      
      console.log('[QUEUE DEBUG] Proceeding with token approvals for 5 tokens (HBAR is native)');
      
      // Queue all 5 token approvals (HBAR doesn't need approval)
      const wbtcApprovalId = await this.queueTokenApproval({
        tokenType: 'WBTC',
        tokenName: 'WBTC',
        tokenId: TOKEN_CONFIG.WBTC.tokenId,
        contractId: TOKEN_CONFIG.WBTC.contractId,
        amount: wbtcAmount
      });
      
      const sauceApprovalId = await this.queueTokenApproval({
        tokenType: 'SAUCE',
        tokenName: 'SAUCE',
        tokenId: TOKEN_CONFIG.SAUCE.tokenId,
        contractId: TOKEN_CONFIG.SAUCE.contractId,
        amount: sauceAmount
      });
      
      const usdcApprovalId = await this.queueTokenApproval({
        tokenType: 'USDC',
        tokenName: 'USDC',
        tokenId: TOKEN_CONFIG.USDC.tokenId,
        contractId: TOKEN_CONFIG.USDC.contractId,
        amount: usdcAmount
      });
      
      const jamApprovalId = await this.queueTokenApproval({
        tokenType: 'JAM',
        tokenName: 'JAM',
        tokenId: TOKEN_CONFIG.JAM.tokenId,
        contractId: TOKEN_CONFIG.JAM.contractId,
        amount: jamAmount
      });
      
      const headstartApprovalId = await this.queueTokenApproval({
        tokenType: 'HEADSTART',
        tokenName: 'HEADSTART',
        tokenId: TOKEN_CONFIG.HEADSTART.tokenId,
        contractId: TOKEN_CONFIG.HEADSTART.contractId,
        amount: headstartAmount
      });
      
      console.log(`[QUEUE DEBUG] All token approvals queued`);
      
      // Create a unique ID for the mint transaction
      const mintTxId = `mint-lynx-${uuid().slice(0, 8)}`;
      
      // Queue the mint transaction after all approvals
      this.queueManager.enqueue({
        id: mintTxId,
        name: `Mint ${lynxAmount} LYNX`,
        createTransaction: async () => {
          // Check that all approvals completed successfully
          console.log(`[QUEUE DEBUG] Verifying all approval transactions before minting...`);
          
          const approvals = [
            { id: wbtcApprovalId, name: 'WBTC' },
            { id: sauceApprovalId, name: 'SAUCE' },
            { id: usdcApprovalId, name: 'USDC' },
            { id: jamApprovalId, name: 'JAM' },
            { id: headstartApprovalId, name: 'HEADSTART' }
          ];
          
          for (const approval of approvals) {
            const transaction = this.queueManager.getTransaction(approval.id);
            if (!transaction) {
              console.error(`[QUEUE DEBUG] ${approval.name} approval transaction not found`);
              throw new Error(`${approval.name} approval transaction not found`);
            }
            
            if (transaction.status !== 'completed') {
              console.error(`[QUEUE DEBUG] ${approval.name} approval status: ${transaction.status}`);
              throw new Error(`${approval.name} approval not completed - status: ${transaction.status}`);
            }
          }
          
          console.log(`[QUEUE DEBUG] All approvals completed successfully, executing mint`);
          
          // Execute the mint transaction using DepositMinterV2
          const mintResult = await this.transactionService!.mintLynx(lynxAmount);
          
          if (mintResult.status === 'error') {
            console.error(`[QUEUE DEBUG] Minting failed:`, mintResult.error);
            throw mintResult.error || new Error('LYNX minting failed');
          }
          
          console.log(`[QUEUE DEBUG] LYNX minting completed successfully`);
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
        wbtcApprovalId,
        sauceApprovalId,
        usdcApprovalId,
        jamApprovalId,
        headstartApprovalId,
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
   * Get token ratios for calculating required tokens (6-token system)
   * These values match the contract's calculateRequiredDeposits function
   */
  public getTokenRatios(): { hbarRatio: number; wbtcRatio: number; sauceRatio: number; usdcRatio: number; jamRatio: number; headstartRatio: number; } {
    return {
      hbarRatio: 4,         // 4 HBAR per LYNX 
      wbtcRatio: 0.04,      // 0.04 WBTC per LYNX
      sauceRatio: 1.8,      // 1.8 SAUCE per LYNX
      usdcRatio: 2.2,       // 2.2 USDC per LYNX
      jamRatio: 3,          // 3 JAM per LYNX
      headstartRatio: 2     // 2 HEADSTART per LYNX
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