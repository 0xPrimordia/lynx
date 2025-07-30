export interface TokenInfo {
  totalSupply: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface TokenBalance {
  balance: string;
  tokenId: string;
}

export class MirrorNodeService {
  private baseUrl: string;

  constructor() {
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    this.baseUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
  }

  /**
   * Fetch token information including total supply
   */
  async getTokenInfo(tokenId: string): Promise<TokenInfo | null> {
    try {
      const url = `${this.baseUrl}/api/v1/tokens/${tokenId}`;
      console.log(`[MirrorNodeService] Fetching token info from: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`[MirrorNodeService] Failed to fetch token info for ${tokenId}:`, response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      console.log(`[MirrorNodeService] Token info response:`, data);
      
      return {
        totalSupply: data.total_supply || '0',
        symbol: data.symbol || '',
        name: data.name || '',
        decimals: data.decimals || 0
      };
    } catch (error) {
      console.error(`[MirrorNodeService] Error fetching token info for ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Fetch token balance for a specific account
   */
  async getTokenBalance(accountId: string, tokenId: string): Promise<string> {
    try {
      const url = `${this.baseUrl}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`;
      console.log(`[MirrorNodeService] Fetching balance from: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`[MirrorNodeService] Failed to fetch balance for ${accountId}/${tokenId}:`, response.status, response.statusText);
        return '0';
      }

      const data = await response.json();
      console.log(`[MirrorNodeService] Balance response:`, data);
      
      if (data.tokens && data.tokens.length > 0) {
        return data.tokens[0].balance || '0';
      }
      
      return '0';
    } catch (error) {
      console.error(`[MirrorNodeService] Error fetching balance for ${accountId}/${tokenId}:`, error);
      return '0';
    }
  }

  /**
   * Fetch HBAR balance for a specific account
   */
  async getHbarBalance(accountId: string): Promise<string> {
    try {
      const url = `${this.baseUrl}/api/v1/accounts/${accountId}`;
      console.log(`[MirrorNodeService] Fetching HBAR balance from: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`[MirrorNodeService] Failed to fetch HBAR balance for ${accountId}:`, response.status, response.statusText);
        return '0';
      }

      const data = await response.json();
      console.log(`[MirrorNodeService] HBAR balance response:`, data);
      
      // HBAR balance is in tinybars (1 HBAR = 100,000,000 tinybars)
      return data.balance?.balance || '0';
    } catch (error) {
      console.error(`[MirrorNodeService] Error fetching HBAR balance for ${accountId}:`, error);
      return '0';
    }
  }

  /**
   * Format token amount with proper decimals
   */
  formatTokenAmount(amount: string, decimals: number): string {
    const numAmount = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    
    const wholePart = (numAmount / divisor).toString();
    const fractionalPart = (numAmount % divisor).toString().padStart(decimals, '0');
    
    // Remove trailing zeros from fractional part
    const trimmedFractional = fractionalPart.replace(/0+$/, '');
    
    if (trimmedFractional === '') {
      return wholePart;
    }
    
    return `${wholePart}.${trimmedFractional}`;
  }

  /**
   * Format large numbers with K, M, B suffixes
   */
  formatNumber(num: number): string {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
} 