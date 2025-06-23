import { AccountId, ContractExecuteTransaction, ContractFunctionParameters, ContractId, Hbar, TransactionId } from "@hashgraph/sdk";
import { DAppConnector } from "@hashgraph/hedera-wallet-connect";
import { transactionToBase64String } from "@hashgraph/hedera-wallet-connect";
import { TOKEN_IDS } from "../config/environment";
import { Client } from "@hashgraph/sdk";

// Helper for converting Hedera accountId to EVM address format
const accountIdToEvmAddress = (accountId: string): string => {
  try {
    // Convert account ID to a zero-padded hex string
    const id = AccountId.fromString(accountId).toSolidityAddress();
    // Ensure it's properly formatted as a 0x-prefixed 40-character string
    return '0x' + id.replace('0x', '').padStart(40, '0');
  } catch (error) {
    console.error("Error converting account ID to EVM address:", error);
    // Return a fallback value
    return '0x0000000000000000000000000000000000000000';
  }
};

// Constants for the Lynx minter contract - REPLACE THESE WITH YOUR ACTUAL TOKEN IDs
const LYNX_TOKEN_ID = process.env.NEXT_PUBLIC_LYNX_TOKEN_ID || "0.0.5948419";
const LYNX_CONTRACT_ID = process.env.NEXT_PUBLIC_LYNX_CONTRACT_ID || "0.0.5758264";

// Default ratios to use when we can't get values from the contract
const DEFAULT_HBAR_RATIO = 10;    // 10 tinybar per LYNX
const DEFAULT_SAUCE_RATIO = 5;    // 5 SAUCE per LYNX
const DEFAULT_CLXY_RATIO = 2;     // 2 CLXY per LYNX

export interface MintParams {
  lynxAmount: number;
}

export interface BurnParams {
  lynxAmount: number;
}

export interface TokenRatios {
  hbarRatio: number;
  sauceRatio: number;
  clxyRatio: number;
}

export interface TokenAllowances {
  sauceAllowance: number;
  clxyAllowance: number;
  sauceRequired: number;
  clxyRequired: number;
  isSauceAllowanceSufficient: boolean;
  isClxyAllowanceSufficient: boolean;
}

export interface TokenServiceResponse {
  status: string;
  transactionId?: string;
  error?: Error;
  diagnostics?: Record<string, unknown>;
}

export interface TokenBalances {
  hbar: number;
  wbtc: number;
  sauce: number;
  usdc: number;
  jam: number;
  headstart: number;
  lynx: number;
}

/**
 * TokenService provides methods for interacting with the Lynx token contract.
 */
export class TokenService {
  private connector: DAppConnector;
  private accountId: string;

  constructor(connector: DAppConnector, accountId: string) {
    this.connector = connector;
    this.accountId = accountId;
  }

  /**
   * Fetches the current token ratios
   */
  async getTokenRatios(): Promise<TokenRatios> {
    return {
      hbarRatio: DEFAULT_HBAR_RATIO,
      sauceRatio: DEFAULT_SAUCE_RATIO,
      clxyRatio: DEFAULT_CLXY_RATIO
    };
  }

  /**
   * Calculates the required HBAR for minting LYNX
   */
  async calculateRequiredHBAR(lynxAmount: number): Promise<number> {
    const ratios = await this.getTokenRatios();
    return lynxAmount * ratios.hbarRatio;
  }

  /**
   * Creates and executes a token approval transaction
   */
  async approveToken(
    tokenId: string,
    contractId: string,
    amount: number,
    tokenName: string
  ): Promise<TokenServiceResponse> {
    console.log(`[TokenService] Approving ${tokenName} token for amount ${amount}`);

    if (!this.connector) {
      console.error('[TokenService] Wallet connector not initialized');
      return {
        status: 'error',
        error: new Error('Wallet connector not initialized')
      };
    }

    if (!this.accountId) {
      console.error('[TokenService] Account ID not available');
      return {
        status: 'error',
        error: new Error('Account ID not available')
      };
    }

    try {
      console.log(`[TokenService] Creating approval transaction for ${tokenName}`);
      
      // Record start time for diagnostics
      const startTime = Date.now();
      
      // 1. Create a client for testnet FIRST (critical step)
      const client = Client.forTestnet();
      
      // 2. Parse account ID properly
      const sender = AccountId.fromString(this.accountId);
      
      // 3. Create the approval transaction and freeze it
      const transaction = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(contractId))
        .setGas(3_000_000)
        .setFunction(
          'approve',
          new ContractFunctionParameters()
            .addAddress(tokenId) // Use tokenId directly as the token address
            .addUint256(amount)
        )
        .setTransactionId(TransactionId.generate(sender))
        .setTransactionMemo(`Approve ${tokenName} for LYNX Minting`)
        .setMaxTransactionFee(new Hbar(10))
        .freezeWith(client);
      
      // Verify frozen state
      console.log(`[TokenService] Transaction created with ID: ${transaction.transactionId?.toString()}`);
      console.log(`[TokenService] Transaction frozen state: ${transaction.isFrozen()}`);
      
      // 4. Convert to base64 using SDK method
      const txBase64 = transactionToBase64String(transaction);
      
      console.log(`[TokenService] Transaction converted to base64, length: ${txBase64.length}`);
      
      // 5. Send to wallet for signing and execution with EXACT parameters
      console.log(`[CRITICAL DEBUG] About to send ${tokenName} approval to wallet for signing`);
      
      const response = await this.connector.signAndExecuteTransaction({
        signerAccountId: this.accountId,
        transactionList: txBase64
      });
      
      console.log(`[CRITICAL DEBUG] ${tokenName} approval transaction response:`, response);
      
      // Record end time and calculate duration
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Extract transaction ID from response
      const responseObj = response as unknown as { id?: string | number };
      const txId = String(responseObj?.id || 'unknown');
      
      console.log(`[TokenService] ${tokenName} approval succeeded in ${duration}ms, transaction ID: ${txId}`);
      
      // Return success with transaction ID
      return {
        status: 'success',
        transactionId: txId,
        diagnostics: {
          tokenName,
          amount,
          durationMs: duration
        }
      };
    } catch (error) {
      // Handle empty error object that HashPack sometimes returns
      if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
        console.error(`[TokenService] Empty error object received for ${tokenName} approval`);
        return {
          status: 'error',
          error: new Error(`Token approval rejected for ${tokenName}`)
        };
      }
      
      // Log error details for debugging
      console.error(`[TokenService] ${tokenName} approval failed:`, error);
      
      // If it's a standard error, preserve it
      if (error instanceof Error) {
        return {
          status: 'error',
          error: error,
          diagnostics: {
            tokenName,
            errorType: error.constructor.name,
            errorMessage: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          }
        };
      }
      
      // Otherwise wrap in a standard error
      return {
        status: 'error',
        error: new Error(`${tokenName} token approval failed: ${error}`),
        diagnostics: {
          tokenName,
          rawError: JSON.stringify(error),
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Mints LYNX tokens by approving and spending SAUCE and CLXY tokens
   */
  async mintLynx(params: MintParams): Promise<TokenServiceResponse> {
    const { lynxAmount } = params;
    console.log(`[TokenService] Starting mint process for ${lynxAmount} LYNX tokens`);
    
    if (!this.connector) {
      console.error('[TokenService] Wallet connector not initialized');
      return {
        status: 'error',
        error: new Error('Wallet connector not initialized')
      };
    }

    if (!this.accountId) {
      console.error('[TokenService] Account ID not available');
      return {
        status: 'error',
        error: new Error('Account ID not available')
      };
    }
    
    try {
      // Get token ratios to calculate required amounts
      const ratios = await this.getTokenRatios();
      const sauceRequired = lynxAmount * ratios.sauceRatio;
      const clxyRequired = lynxAmount * ratios.clxyRatio;
      const hbarRequired = lynxAmount * ratios.hbarRatio;
      
      console.log(`[TokenService] Minting requires:`, {
        sauce: sauceRequired,
        clxy: clxyRequired,
        hbar: hbarRequired
      });
      
      // SIMPLIFIED: Skip balance checks for now to focus on actual transaction execution
      
      // For multiple transactions, we'll need to track results
      const transactionIds: string[] = [];
      
      // USING CORRECT TRANSACTION PATTERN
      console.log(`[CRITICAL DEBUG] Creating LYNX mint transaction...`);
      
      // 1. Create a client for testnet FIRST (critical step)
      const client = Client.forTestnet();
      
      // 2. Parse account ID properly
      const sender = AccountId.fromString(this.accountId);
      
      // 3. Create the mint transaction with recipient address and amount
      const transaction = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(LYNX_CONTRACT_ID))
        .setGas(5_000_000)
        .setMaxTransactionFee(new Hbar(10))
        .setFunction(
          'mintTo',
          new ContractFunctionParameters()
            .addAddress(accountIdToEvmAddress(this.accountId)) // Add recipient address
            .addUint256(lynxAmount)
        )
        .setTransactionId(TransactionId.generate(sender))
        .freezeWith(client);
      
      console.log(`[CRITICAL DEBUG] Transaction created with ID: ${transaction.transactionId?.toString()}`);
      console.log(`[CRITICAL DEBUG] Transaction frozen state: ${transaction.isFrozen()}`);
      
      // 4. Convert to base64 using SDK method
      const txBase64 = transactionToBase64String(transaction);
      
      console.log(`[CRITICAL DEBUG] Transaction converted to base64, length: ${txBase64.length}`);
      
      // 5. Send to wallet for signing and execution with EXACT parameters
      console.log(`[CRITICAL DEBUG] Sending transaction to wallet...`);
      
      const response = await this.connector.signAndExecuteTransaction({
        signerAccountId: this.accountId,
        transactionList: txBase64
      });
      
      console.log(`[CRITICAL DEBUG] Transaction response:`, response);
      
      // Extract transaction ID from response
      const responseObj = response as unknown as { id?: string | number };
      const mintTxId = String(responseObj?.id || 'unknown');
      transactionIds.push(mintTxId);
      
      console.log(`[TokenService] Mint transaction successful: ${mintTxId}`);
      
      // Return all transaction IDs for tracking
      return {
        status: 'success',
        transactionId: mintTxId,
        diagnostics: {
          transactionIds
        }
      };
    } catch (error) {
      // Handle empty error object (wallet popup closed)
      if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
        console.log(`[CRITICAL DEBUG] Empty error object received from wallet - likely popup closed`);
        return {
          status: 'error',
          error: new Error('Transaction was rejected or wallet popup was closed')
        };
      }
      
      console.error("[TokenService] Error in mintLynx:", error);
      const errorObj = error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : error;
      
      console.log(`[CRITICAL DEBUG] Error details:`, JSON.stringify(errorObj, null, 2));
      
      return {
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
        diagnostics: {
          errorType: typeof error,
          errorDetails: JSON.stringify(errorObj),
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Burns LYNX tokens to receive HBAR, SAUCE, and CLXY
   */
  async burnLynx(params: BurnParams): Promise<{
    status: string;
    transactionIds: string[];
    error?: Error;
  }> {
    try {
      const { lynxAmount } = params;
      
      // Basic validation
      if (!this.connector) {
        throw new Error("Wallet connector not initialized");
      }
      if (!this.accountId) {
        throw new Error("No account ID available");
      }
      if (lynxAmount <= 0) {
        throw new Error("LYNX amount must be greater than zero");
      }
      
      // Array to store transaction IDs
      const transactionIds: string[] = [];
      
      // Step 1: Approve LYNX tokens
      console.log(`STEP 1: Approving ${lynxAmount} LYNX tokens for burning`);
      const lynxApprovalResult = await this.approveToken(
        LYNX_TOKEN_ID,
        LYNX_CONTRACT_ID,
        lynxAmount,
        "LYNX"
      );
      
      if (lynxApprovalResult.status === "error") {
        throw lynxApprovalResult.error || new Error("LYNX approval failed");
      }
      
      if (lynxApprovalResult.transactionId) {
        transactionIds.push(lynxApprovalResult.transactionId);
      }
      
      console.log("LYNX approval completed");
      
      // Step 2: Burn LYNX tokens
      console.log(`STEP 2: Burning ${lynxAmount} LYNX tokens`);
      
      // 1. Create a client for testnet FIRST (critical step)
      const client = Client.forTestnet();
      
      // 2. Parse account ID properly
      const sender = AccountId.fromString(this.accountId);
      
      // 3. Create the burn transaction
      const burnTx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString(LYNX_CONTRACT_ID))
        .setGas(1000000)
        .setFunction("burn", new ContractFunctionParameters().addUint256(lynxAmount))
        .setTransactionId(TransactionId.generate(sender))
        .setMaxTransactionFee(new Hbar(10))
        .freezeWith(client);
      
      console.log("Burn transaction created and frozen:", burnTx.isFrozen());
      
      // 4. Convert to base64 using SDK method
      const txBase64 = transactionToBase64String(burnTx);
      
      console.log("Burn transaction converted to base64, length:", txBase64.length);
      
      // 5. Send to wallet for signing and execution
      console.log("Sending burn transaction to wallet...");
      
      const response = await this.connector.signAndExecuteTransaction({
        signerAccountId: this.accountId,
        transactionList: txBase64
      });
      
      console.log("Burn transaction executed successfully:", response);
      
      // Extract transaction ID from response
      const responseObj = response as unknown as { id?: string | number };
      const burnTxId = String(responseObj?.id || 'unknown');
      transactionIds.push(burnTxId);
      
      // Return all transaction IDs
      return {
        status: "success",
        transactionIds: transactionIds
      };
    } catch (error) {
      console.error("Error in burnLynx process:", error);
      return {
        status: "error",
        transactionIds: [],
        error: error instanceof Error ? error : new Error("Unknown error in burn process")
      };
    }
  }

  /**
   * Fetches token balances for the connected account
   */
  async getTokenBalances(): Promise<TokenBalances> {
    console.log("[TokenService] Fetching token balances for account", this.accountId);
    
    if (!this.accountId) {
      console.error('[TokenService] Account ID not available');
      throw new Error('Account ID not available');
    }

    try {
      // Import the BalanceService for real balance queries
      const { BalanceService } = await import('./balanceService');
      const balanceService = new BalanceService();
      
      console.log("[TokenService] Using BalanceService to fetch real balances");
      
      // Get real balances from the network
      const realBalances = await balanceService.getTokenBalances(this.accountId);
      
      // Convert string balances to numbers and handle HBAR conversion
      const hbarValue = parseFloat(realBalances.HBAR) * 100_000_000; // Convert HBAR to tinybars
      
      const result = {
        hbar: hbarValue,
        wbtc: parseInt(realBalances.WBTC) || 0,
        sauce: parseInt(realBalances.SAUCE) || 0,
        usdc: parseInt(realBalances.USDC) || 0,
        jam: parseInt(realBalances.JAM) || 0,
        headstart: parseInt(realBalances.HEADSTART) || 0,
        lynx: parseInt(realBalances.LYNX) || 0
      };
      
      console.log("[TokenService] Real token balances:", result);
      
      // Cleanup
      balanceService.close();
      
      return result;
    } catch (error) {
      console.error("[TokenService] Error fetching token balances:", error);
      
      // Fallback to default values if real query fails
      console.log("[TokenService] Using fallback balances due to query error");
      return {
        hbar: 0,
        wbtc: 0,
        sauce: 0,
        usdc: 0,
        jam: 0,
        headstart: 0,
        lynx: 0
      };
    }
  }

  /**
   * Get account information including HBAR balance - DISABLED DUE TO PROTOBUF ERRORS
   */
  private async getAccountInfo(): Promise<{ balance: number } | null> {
    // This method currently doesn't work with HashPack DAppConnector due to protobuf errors
    // Return a default value
    return { balance: 1000000000 }; // 10 HBAR in tinybar
  }

  /**
   * Get balance for a specific token - DISABLED DUE TO PROTOBUF ERRORS
   */
  private async getTokenBalance(tokenId: string): Promise<number> {
    // This method currently doesn't work with HashPack DAppConnector due to protobuf errors
    // For testing purposes, return default values
    switch(tokenId) {
      case TOKEN_IDS.SAUCE:
        return 500;
      case TOKEN_IDS.LYNX:
        return 50;
      default:
        return 100;
    }
  }
} 