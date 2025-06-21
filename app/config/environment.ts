export const isDevelopment = process.env.NODE_ENV === 'development';
export const isTestEnvironment = process.env.NEXT_PUBLIC_USE_TEST_MODE === 'true';

// Only use mock data if explicitly configured for testing
export const useMockData = isTestEnvironment;

// Contract configuration
export const CONTRACT_IDS = {
  DEPOSIT_MINTER: process.env.NEXT_PUBLIC_DEPOSIT_MINTER_ID || '0x99b532407d3c9c4Fc5c0f2A620cF3dE26934a674',
  LYNX: process.env.NEXT_PUBLIC_LYNX_CONTRACT_HEDERA_ID || '0x2531150c2C826c9Fc27f1479B07417510A6cc79a', // Keep for backward compatibility
};

// Token IDs - Using working LYNX token from hybrid approach
export const TOKEN_IDS = {
  LYNX: process.env.NEXT_PUBLIC_LYNX_TOKEN_ID || '0.0.5948419',
  SAUCE: process.env.NEXT_PUBLIC_SAUCE_TOKEN_ID || '0.0.1183558',
  CLXY: process.env.NEXT_PUBLIC_CLXY_TOKEN_ID || '0.0.5365',
}; 