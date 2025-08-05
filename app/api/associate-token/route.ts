import { NextRequest, NextResponse } from 'next/server';
import { 
  TokenAssociateTransaction, 
  AccountId, 
  TransactionId,
  Hbar 
} from '@hashgraph/sdk';
import { transactionToBase64String } from '@hashgraph/hedera-wallet-connect';

interface AssociateTokenRequest {
  accountId: string;
  tokenId: string;
}

interface AssociateTokenResponse {
  success: boolean;
  transaction?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: AssociateTokenRequest = await request.json();
    const { accountId, tokenId } = body;

    if (!accountId || !tokenId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: accountId, tokenId' },
        { status: 400 }
      );
    }

    console.log(`[API] Creating association transaction for account ${accountId} with token ${tokenId}`);

    // Create unfrozen TokenAssociateTransaction for extension wallet
    const associateTransaction = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds([tokenId])
      .setTransactionId(TransactionId.generate(AccountId.fromString(accountId)))
      .setMaxTransactionFee(new Hbar(10)); // Higher fee for reliability

    // CRITICAL: DO NOT FREEZE for extension wallets
    console.log('[API] Creating unfrozen association transaction for extension wallet');

    // Convert to base64 string for extension wallet
    const transactionBase64 = transactionToBase64String(associateTransaction);

    console.log(`[API] Association transaction created successfully for ${accountId}`);

    const result: AssociateTokenResponse = {
      success: true,
      transaction: transactionBase64
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[API] Error creating association transaction:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
} 