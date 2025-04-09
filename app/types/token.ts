export interface TokenServiceResponse {
  status: 'success' | 'error';
  transactionId?: string;
  error?: Error;
  diagnostics?: {
    transactionIds: string[];
  };
}

export interface MintParams {
  lynxAmount: number;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: Error) => void;
} 