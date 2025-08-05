import { NextRequest, NextResponse } from 'next/server';

interface AssociationCheckRequest {
  accountId: string;
  tokenId: string;
}

interface AssociationCheckResponse {
  isAssociated: boolean;
  tokenId: string;
  accountId: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: AssociationCheckRequest = await request.json();
    const { accountId, tokenId } = body;

    if (!accountId || !tokenId) {
      return NextResponse.json(
        { error: 'Missing required parameters: accountId, tokenId' },
        { status: 400 }
      );
    }

    console.log(`[API] Checking association for account ${accountId} with token ${tokenId}`);

    // Get network from environment
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    
    // Query Hedera mirror node to check token relationships
    const mirrorNodeUrl = `https://${network}.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`;
    
    console.log(`[API] Querying mirror node: ${mirrorNodeUrl}`);
    
    const response = await fetch(mirrorNodeUrl);
    
    if (!response.ok) {
      console.error(`[API] Mirror node query failed: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Failed to query token association status' },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    // If tokens array is empty, the account is not associated
    const isAssociated = data.tokens && data.tokens.length > 0;
    
    console.log(`[API] Association result for ${accountId} with ${tokenId}: ${isAssociated}`);
    
    const result: AssociationCheckResponse = {
      isAssociated,
      tokenId,
      accountId
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[API] Error checking token association:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isAssociated: false 
      },
      { status: 500 }
    );
  }
} 