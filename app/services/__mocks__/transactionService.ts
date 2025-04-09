/**
 * Mock implementation of the TransactionService
 */
export class TransactionService {
  constructor() {}
  
  approveToken = jest.fn().mockResolvedValue({
    status: 'success',
    txId: 'mock-approve-tx-id'
  });
  
  mintLynx = jest.fn().mockResolvedValue({
    status: 'success',
    txId: 'mock-mint-tx-id'
  });
}

export default TransactionService; 