// Mock implementation of the useWallet hook
export const useWallet = jest.fn().mockReturnValue({
  connector: {
    signAndExecuteTransaction: jest.fn().mockResolvedValue({
      response: {
        transactionId: 'mock-transaction-id',
        success: true
      }
    })
  },
  account: {
    accountId: '0.0.12345',
    network: 'testnet'
  },
  status: 'connected',
  isConnected: true,
  isConnecting: false,
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  error: null
});

export default useWallet; 