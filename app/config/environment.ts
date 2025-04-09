export const isDevelopment = process.env.NODE_ENV === 'development';
export const isTestEnvironment = process.env.NEXT_PUBLIC_USE_TEST_MODE === 'true';

// Only use mock data if explicitly configured for testing
export const useMockData = isTestEnvironment;

// Token contract configuration
export const CONTRACT_IDS = {
  LYNX: process.env.NEXT_PUBLIC_LYNX_CONTRACT_ID || '0.0.5758264',
};

// Token IDs
export const TOKEN_IDS = {
  LYNX: process.env.NEXT_PUBLIC_LYNX_TOKEN_ID || '0.0.3059001',
  SAUCE: process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID || '0.0.1183558',
  CLXY: process.env.NEXT_PUBLIC_CLXY_TOKEN_ID || '0.0.1318237',
}; 