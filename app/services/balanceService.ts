import { 
  Client, 
  AccountId, 
  TokenId, 
  AccountBalanceQuery 
} from '@hashgraph/sdk';

// Token IDs from environment variables
const SAUCE_TOKEN_ID = process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID || "0.0.1183558";
const WBTC_TOKEN_ID = process.env.NEXT_PUBLIC_WBTC_TOKEN_ID || "0.0.6212930";
const USDC_TOKEN_ID = process.env.NEXT_PUBLIC_USDC_TOKEN_ID || "0.0.6212931";
const JAM_TOKEN_ID = process.env.NEXT_PUBLIC_JAM_TOKEN_ID || "0.0.6212932";
const HEADSTART_TOKEN_ID = process.env.NEXT_PUBLIC_HEADSTART_TOKEN_ID || "0.0.6212933";
const LYNX_TOKEN_ID = process.env.NEXT_PUBLIC_LYNX_TOKEN_ID || "0.0.5948419";

export interface TokenBalances {
  HBAR: string;
  SAUCE: string;
  WBTC: string;
  USDC: string;
  JAM: string;
  HEADSTART: string;
  LYNX: string;
}

interface TokenInfo {
  decimals: number;
  symbol: string;
  name: string;
}

export class BalanceService {
  private client: Client;

  constructor() {
    // Create client for testnet
    this.client = Client.forTestnet();
  }

  /**
   * Get token info including decimals
   */
  private getTokenInfo(tokenId: string): TokenInfo {
    // Use known decimal counts for our specific tokens
    switch (tokenId) {
      case SAUCE_TOKEN_ID:
        return {
          decimals: 6,
          symbol: 'SAUCE',
          name: 'SaucerSwap Token'
        };
      case WBTC_TOKEN_ID:
        return {
          decimals: 8,
          symbol: 'WBTC',
          name: 'Wrapped Bitcoin'
        };
      case USDC_TOKEN_ID:
        return {
          decimals: 6,
          symbol: 'USDC',
          name: 'USD Coin'
        };
      case JAM_TOKEN_ID:
        return {
          decimals: 8,
          symbol: 'JAM',
          name: 'JAM Token'
        };
      case HEADSTART_TOKEN_ID:
        return {
          decimals: 8,
          symbol: 'HEADSTART',
          name: 'HeadStarter Token'
        };
      case LYNX_TOKEN_ID:
        return {
          decimals: 8,
          symbol: 'LYNX',
          name: 'LYNX Token'
        };
      default:
        return {
          decimals: 8,
          symbol: 'UNKNOWN',
          name: 'Unknown Token'
        };
    }
  }

  /**
   * Convert raw token balance to human-readable amount
   */
  private formatTokenBalance(rawBalance: bigint, decimals: number): string {
    if (decimals === 0) {
      return rawBalance.toString();
    }
    
    const divisor = BigInt(10 ** decimals);
    const wholePart = rawBalance / divisor;
    const fractionalPart = rawBalance % divisor;
    
    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }
    
    // Convert fractional part to decimal string
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    // Remove trailing zeros
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    
    if (trimmedFractional === '') {
      return wholePart.toString();
    }
    
    return `${wholePart}.${trimmedFractional}`;
  }

  /**
   * Fetch actual token balances for an account from Hedera network
   */
  async getTokenBalances(accountId: string): Promise<TokenBalances> {
    try {
      console.log(`[BalanceService] Fetching balances for account: ${accountId}`);
      
      // Create account balance query
      const balanceQuery = new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(accountId));

      // Execute the query
      const accountBalance = await balanceQuery.execute(this.client);
      
      // Get HBAR balance (already formatted by SDK)
      const hbarBalance = accountBalance.hbars.toString().replace(' ℏ', '');
      
      // Get token balances from the tokens map
      const tokens = accountBalance.tokens;
      
             // Get token info for proper decimal handling
       const sauceInfo = this.getTokenInfo(SAUCE_TOKEN_ID);
       const wbtcInfo = this.getTokenInfo(WBTC_TOKEN_ID);
       const usdcInfo = this.getTokenInfo(USDC_TOKEN_ID);
       const jamInfo = this.getTokenInfo(JAM_TOKEN_ID);
       const headstartInfo = this.getTokenInfo(HEADSTART_TOKEN_ID);
       const lynxInfo = this.getTokenInfo(LYNX_TOKEN_ID);
      
             // Extract and format token balances with proper decimals
       const sauceRawBalance = tokens && tokens.get(TokenId.fromString(SAUCE_TOKEN_ID)) 
         ? BigInt(tokens.get(TokenId.fromString(SAUCE_TOKEN_ID))!.toString()) 
         : BigInt(0);
       const sauceBalance = this.formatTokenBalance(sauceRawBalance, sauceInfo.decimals);
         
       const wbtcRawBalance = tokens && tokens.get(TokenId.fromString(WBTC_TOKEN_ID)) 
         ? BigInt(tokens.get(TokenId.fromString(WBTC_TOKEN_ID))!.toString()) 
         : BigInt(0);
       const wbtcBalance = this.formatTokenBalance(wbtcRawBalance, wbtcInfo.decimals);
         
       const usdcRawBalance = tokens && tokens.get(TokenId.fromString(USDC_TOKEN_ID)) 
         ? BigInt(tokens.get(TokenId.fromString(USDC_TOKEN_ID))!.toString()) 
         : BigInt(0);
       const usdcBalance = this.formatTokenBalance(usdcRawBalance, usdcInfo.decimals);
         
       const jamRawBalance = tokens && tokens.get(TokenId.fromString(JAM_TOKEN_ID)) 
         ? BigInt(tokens.get(TokenId.fromString(JAM_TOKEN_ID))!.toString()) 
         : BigInt(0);
       const jamBalance = this.formatTokenBalance(jamRawBalance, jamInfo.decimals);
         
       const headstartRawBalance = tokens && tokens.get(TokenId.fromString(HEADSTART_TOKEN_ID)) 
         ? BigInt(tokens.get(TokenId.fromString(HEADSTART_TOKEN_ID))!.toString()) 
         : BigInt(0);
       const headstartBalance = this.formatTokenBalance(headstartRawBalance, headstartInfo.decimals);
         
       const lynxRawBalance = tokens && tokens.get(TokenId.fromString(LYNX_TOKEN_ID)) 
         ? BigInt(tokens.get(TokenId.fromString(LYNX_TOKEN_ID))!.toString()) 
         : BigInt(0);
       const lynxBalance = this.formatTokenBalance(lynxRawBalance, lynxInfo.decimals);

      const balances: TokenBalances = {
        HBAR: hbarBalance,
        SAUCE: sauceBalance,
        WBTC: wbtcBalance,
        USDC: usdcBalance,
        JAM: jamBalance,
        HEADSTART: headstartBalance,
        LYNX: lynxBalance
      };

      console.log(`[BalanceService] Successfully fetched and formatted balances:`, balances);
      console.log(`[BalanceService] Token decimals - SAUCE: ${sauceInfo.decimals}, WBTC: ${wbtcInfo.decimals}, USDC: ${usdcInfo.decimals}, JAM: ${jamInfo.decimals}, HEADSTART: ${headstartInfo.decimals}, LYNX: ${lynxInfo.decimals}`);
      
      return balances;

    } catch (error) {
      console.error(`[BalanceService] Error fetching balances:`, error);
      
      // Fallback to default values if query fails
      console.log(`[BalanceService] Using fallback balances due to query error`);
      return {
        HBAR: '0',
        SAUCE: '0',
        WBTC: '0',
        USDC: '0',
        JAM: '0',
        HEADSTART: '0',
        LYNX: '0'
      };
    }
  }

  /**
   * Close the client connection
   */
  close(): void {
    if (this.client) {
      this.client.close();
    }
  }
} 