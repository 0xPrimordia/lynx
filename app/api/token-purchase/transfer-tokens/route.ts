import { NextRequest, NextResponse } from 'next/server';
import { 
  Client, 
  AccountId, 
  PrivateKey, 
  TokenId, 
  TransferTransaction,
  Hbar,
  Status
} from '@hashgraph/sdk';

interface TokenTransferRequest {
  tokenAmounts: {
    [token: string]: {
      amount: number;
      valueUSD: number;
      weight: number;
    };
  };
  userAccountId: string;
  hbarTransferTxId?: string; // Optional: for tracking purposes
}

interface TokenTransferResult {
  success: boolean;
  txIds?: string[];
  error?: string;
  failedTokens?: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: TokenTransferRequest = await request.json();
    const { tokenAmounts, userAccountId, hbarTransferTxId } = body;

    // Validate request
    if (!tokenAmounts || !userAccountId) {
      return NextResponse.json(
        { error: 'Missing required parameters: tokenAmounts, userAccountId' },
        { status: 400 }
      );
    }

    // Get server-side environment variables
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY; // Private key - server-side only

    if (!operatorId || !operatorKey) {
      console.error('[API] Missing operator credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    console.log(`[API] Processing token transfer for user ${userAccountId}`);
    if (hbarTransferTxId) {
      console.log(`[API] HBAR transfer transaction ID: ${hbarTransferTxId}`);
    }

    // Initialize Hedera client
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );

    // Token configuration
    const tokenConfig: { [key: string]: { id: string; decimals: number } } = {
      WBTC: { id: process.env.NEXT_PUBLIC_WBTC_TOKEN_ID || '0.0.6212930', decimals: 8 },
      SAUCE: { id: process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID || '0.0.1183558', decimals: 6 },
      USDC: { id: process.env.NEXT_PUBLIC_USDC_TOKEN_ID || '0.0.6212931', decimals: 6 },
      JAM: { id: process.env.NEXT_PUBLIC_JAM_TOKEN_ID || '0.0.6212932', decimals: 8 },
      HEADSTART: { id: process.env.NEXT_PUBLIC_HEADSTART_TOKEN_ID || '0.0.6212933', decimals: 8 }
    };

    const results: TokenTransferResult = {
      success: true,
      txIds: [],
      failedTokens: []
    };

    // Process each token transfer
    for (const [tokenSymbol, tokenData] of Object.entries(tokenAmounts)) {
      try {
        const tokenConfigItem = tokenConfig[tokenSymbol];
        if (!tokenConfigItem) {
          console.warn(`[API] No token config found for ${tokenSymbol}`);
          results.failedTokens?.push(tokenSymbol);
          continue;
        }

        // Convert amount to proper decimal format
        const rawAmount = Math.floor(tokenData.amount * Math.pow(10, tokenConfigItem.decimals));
        
        console.log(`[API] Transferring ${tokenData.amount} ${tokenSymbol} (${rawAmount} raw units) to ${userAccountId}`);

        // Create token transfer transaction
        const transferTx = new TransferTransaction()
          .addTokenTransfer(
            TokenId.fromString(tokenConfigItem.id),
            operatorId,
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
        const txResponse = await transferTx.execute(client);
        
        // Wait for receipt
        const receipt = await txResponse.getReceipt(client);
        
        if (receipt.status !== Status.Success) {
          throw new Error(`Transaction failed with status: ${receipt.status}`);
        }

        console.log(`[API] ${tokenSymbol} transfer successful:`, txResponse.transactionId);
        results.txIds?.push(txResponse.transactionId.toString());

      } catch (error) {
        console.error(`[API] ${tokenSymbol} transfer failed:`, error);
        results.failedTokens?.push(tokenSymbol);
        
        // Check if it's an association error
        if (error instanceof Error && 
            (error.message.includes('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT') || 
             error.message.includes('TOKEN_ID_REPEATED_IN_TOKEN_LIST'))) {
          console.log(`[API] ${tokenSymbol} needs association`);
        }
      }
    }

    // Determine overall success
    if (results.failedTokens && results.failedTokens.length > 0) {
      results.success = false;
      
      // Check if all failures are due to missing associations
      const allAssociationErrors = results.failedTokens.length === Object.keys(tokenAmounts).length;
      
      if (allAssociationErrors) {
        return NextResponse.json({
          success: false,
          error: 'All tokens need to be associated with the user account',
          needsAssociation: true,
          unassociatedTokens: results.failedTokens
        });
      }
      
      return NextResponse.json({
        success: false,
        error: `Some token transfers failed: ${results.failedTokens.join(', ')}`,
        failedTokens: results.failedTokens,
        successfulTxIds: results.txIds
      });
    }

    console.log(`[API] All token transfers completed successfully`);
    return NextResponse.json({
      success: true,
      txIds: results.txIds,
      message: 'Token transfers completed successfully'
    });

  } catch (error) {
    console.error('[API] Token transfer route error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown server error' 
      },
      { status: 500 }
    );
  }
} 