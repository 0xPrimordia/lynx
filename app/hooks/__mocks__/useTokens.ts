// Mock implementation of the useTokens hook
export const useTokens = jest.fn().mockReturnValue({
  tokenIds: {
    SAUCE: '0.0.1183558',
    CLXY: '0.0.1318237',
    LYNX: '0.0.3059001',
    CONTRACT: '0.0.5758264'
  },
  tokenBalances: {
    HBAR: '100',
    SAUCE: '1000',
    CLXY: '1000',
    LYNX: '0'
  },
  tokenPrices: {
    HBAR: 0.065,
    SAUCE: 0.01,
    CLXY: 0.02,
    LYNX: 0.03
  },
  requiredTokens: {
    HBAR: 100,
    SAUCE: 50,
    CLXY: 20
  },
  isLoading: false,
  error: null,
  refreshBalances: jest.fn().mockResolvedValue(true),
  // Mint calculation function
  calculateRequiredTokens: jest.fn().mockImplementation((lynxAmount: number) => {
    return {
      SAUCE: 50 * lynxAmount / 10,
      CLXY: 20 * lynxAmount / 10,
      HBAR: 100 * lynxAmount / 10
    };
  })
});

export default useTokens; 