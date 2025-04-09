'use server';

/**
 * Test what environment variables are accessible in server components
 */
export async function testServerEnvironment(): Promise<{ 
  variables: Record<string, boolean>,
  serverTime: string
}> {
  // Test various environment variables
  const variables: Record<string, boolean> = {
    'NEXT_PUBLIC_OPERATOR_ID': !!process.env.NEXT_PUBLIC_OPERATOR_ID,
    'NEXT_PUBLIC_OPERATOR_KEY': !!process.env.NEXT_PUBLIC_OPERATOR_KEY,
    'NEXT_PUBLIC_LYNX_CONTRACT_ID': !!process.env.NEXT_PUBLIC_LYNX_CONTRACT_ID,
    'NEXT_PUBLIC_LYNX_TOKEN_ID': !!process.env.NEXT_PUBLIC_LYNX_TOKEN_ID,
    'NEXT_PUBLIC_SAUCE_TOKEN_ID': !!process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID,
    'NEXT_PUBLIC_CLXY_TOKEN_ID': !!process.env.NEXT_PUBLIC_CLXY_TOKEN_ID,
    'NODE_ENV': !!process.env.NODE_ENV,
  };

  return {
    variables,
    serverTime: new Date().toISOString()
  };
} 