import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MintForm } from '../../app/components/MintForm';
import { TokenQueueProvider } from '../../app/hooks/useTokenQueue';

// Import the actual hooks so TypeScript knows their types
import type * as TokenHooksTypes from '../../app/hooks/useTokens';
import type * as WalletHooksTypes from '../../app/hooks/useWallet';
import type * as ToastHooksTypes from '../../app/hooks/useToast';

// Mock the necessary hooks and services
jest.mock('../../app/hooks/useTokens');
jest.mock('../../app/hooks/useWallet');
jest.mock('../../app/hooks/useToast');

// Mock NextUI components to avoid dynamic import errors
jest.mock('@nextui-org/button', () => ({
  Button: ({ 
    children, 
    onClick, 
    disabled 
  }: { 
    children: React.ReactNode; 
    onClick?: () => void; 
    disabled?: boolean 
  }) => (
    <button onClick={onClick} disabled={disabled} data-testid="mock-button">
      {children}
    </button>
  )
}));

jest.mock('@nextui-org/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-card-header">{children}</div>,
  CardBody: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-card-body">{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-card-footer">{children}</div>
}));

jest.mock('@nextui-org/input', () => ({
  Input: ({ 
    type, 
    label, 
    value, 
    onChange, 
    disabled, 
    endContent 
  }: { 
    type?: string; 
    label?: string; 
    value?: string | number; 
    onChange?: (e: any) => void; 
    disabled?: boolean; 
    endContent?: React.ReactNode 
  }) => (
    <div data-testid="mock-input">
      <label>{label}</label>
      <input
        type={type}
        aria-label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      {endContent}
    </div>
  )
}));

jest.mock('@nextui-org/progress', () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="mock-progress" data-value={value}></div>
}));

jest.mock('@nextui-org/spinner', () => ({
  Spinner: () => <div data-testid="mock-spinner">Loading...</div>
}));

jest.mock('@nextui-org/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-tooltip">{children}</div>
}));

// Import the mocks
import { useTokens } from '../../app/hooks/__mocks__/useTokens';
import { useWallet } from '../../app/hooks/__mocks__/useWallet';
import { useToast } from '../../app/hooks/__mocks__/useToast';

// Setup toast mock functions
const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastInfo = jest.fn();
const mockToastLoading = jest.fn();

// Override the default toast mock
jest.mock('../../app/hooks/useToast', () => ({
  useToast: () => ({
    toast: {
      error: mockToastError,
      success: mockToastSuccess,
      info: mockToastInfo,
      loading: mockToastLoading,
      warning: jest.fn()
    }
  })
}));

// Mock the TokenQueueService
const mockQueueTokenApproval = jest.fn().mockResolvedValue('mock-tx-id');
const mockQueueMintLynx = jest.fn().mockResolvedValue('mint-tx-id');
const mockGetQueueStats = jest.fn().mockReturnValue({
  totalTransactions: 0,
  completedTransactions: 0,
  failedTransactions: 0,
  pendingTransactions: 0
});
const mockGetTransactionStatus = jest.fn();

// Setup mock services
jest.mock('../../app/services/TokenQueueService', () => {
  return {
    TokenQueueService: jest.fn().mockImplementation(() => {
      return {
        queueTokenApproval: mockQueueTokenApproval,
        queueMintLynx: mockQueueMintLynx,
        getQueueStats: mockGetQueueStats,
        getTransaction: mockGetTransactionStatus,
        updateConnection: jest.fn()
      };
    })
  };
});

// Mock TransactionQueueManager
jest.mock('../../app/services/TransactionQueueManager', () => {
  return {
    TransactionQueueManager: jest.fn().mockImplementation(() => {
      return {
        enqueue: jest.fn().mockReturnValue('mock-tx-id'),
        getStats: jest.fn().mockReturnValue({
          totalTransactions: 0,
          completedTransactions: 0,
          failedTransactions: 0,
          pendingTransactions: 0
        }),
        getTransaction: jest.fn(),
        updateConnection: jest.fn(),
        cleanQueue: jest.fn(),
        isActive: jest.fn().mockReturnValue(false),
        waitForCompletion: jest.fn().mockResolvedValue(true)
      };
    })
  };
});

// Mock TokenQueueProvider to use our mock functions
jest.mock('../../app/hooks/useTokenQueue', () => {
  const originalModule = jest.requireActual('../../app/hooks/useTokenQueue');
  
  return {
    ...originalModule,
    useTokenQueue: () => ({
      queueTokenApproval: mockQueueTokenApproval,
      mintLynx: mockQueueMintLynx,
      getTransactionStatus: mockGetTransactionStatus,
      isProcessing: false,
      queueStats: {
        totalTransactions: 0,
        completedTransactions: 0,
        failedTransactions: 0,
        pendingTransactions: 0
      },
      getTokenRatios: () => ({ hbarRatio: 0.01, sauceRatio: 5, clxyRatio: 2 }),
      calculateRequiredHBAR: (lynxAmount: number) => lynxAmount * 0.01
    })
  };
});

describe('Mint Flow Integration with Queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock functions
    mockToastError.mockClear();
    mockToastSuccess.mockClear();
    mockToastInfo.mockClear();
    mockToastLoading.mockClear();
    mockQueueMintLynx.mockClear();
    
    // Setup mock transaction responses
    mockGetTransactionStatus.mockImplementation((id) => {
      if (id === 'mint-tx-id') {
        return {
          id: 'mint-tx-id',
          name: 'Mint LYNX',
          status: 'completed',
          attempts: 1,
          timestamp: Date.now(),
          result: { status: 'success', txId: 'hedera-mint-tx-id' }
        };
      }
      return undefined;
    });
  });
  
  test('should call queueMintLynx with correct parameters when form is submitted', async () => {
    // Setup user event for interactions
    const user = userEvent.setup();
    
    // Mock successful mint transaction
    mockQueueMintLynx.mockResolvedValue('mint-tx-id');
    
    // Render component with provider
    render(
      <TokenQueueProvider>
        <MintForm />
      </TokenQueueProvider>
    );
    
    // Find the amount input and mint button
    const amountInput = screen.getByLabelText(/amount/i);
    const mintButton = screen.getByTestId('mock-button');
    
    // Enter amount and click mint
    await act(async () => {
      await user.clear(amountInput);
      await user.type(amountInput, '10');
      await user.click(mintButton);
    });
    
    // Verify mint was called with correct parameters
    expect(mockQueueMintLynx).toHaveBeenCalledWith(
      expect.objectContaining({
        lynxAmount: 10
      })
    );
  });
  
  test('should handle failed mint operations', async () => {
    // Setup user event for interactions
    const user = userEvent.setup();
    
    // Mock failed mint
    mockQueueMintLynx.mockRejectedValue(new Error('SAUCE approval failed'));
    
    // Render component with provider
    render(
      <TokenQueueProvider>
        <MintForm />
      </TokenQueueProvider>
    );
    
    // Find the amount input and mint button
    const amountInput = screen.getByLabelText(/amount/i);
    const mintButton = screen.getByTestId('mock-button');
    
    // Enter amount and click mint
    await act(async () => {
      await user.clear(amountInput);
      await user.type(amountInput, '10');
      await user.click(mintButton);
    });
    
    // Verify queueMintLynx was called but failed
    expect(mockQueueMintLynx).toHaveBeenCalled();
  });
  
  test('should handle network errors during mint', async () => {
    // Setup user event for interactions
    const user = userEvent.setup();
    
    // Mock mint error
    mockQueueMintLynx.mockRejectedValue(new Error('Network error'));
    
    // Render component with provider
    render(
      <TokenQueueProvider>
        <MintForm />
      </TokenQueueProvider>
    );
    
    // Find the amount input and mint button
    const amountInput = screen.getByLabelText(/amount/i);
    const mintButton = screen.getByTestId('mock-button');
    
    // Enter amount and click mint
    await act(async () => {
      await user.clear(amountInput);
      await user.type(amountInput, '10');
      await user.click(mintButton);
    });
    
    // Verify mint was attempted but failed
    expect(mockQueueMintLynx).toHaveBeenCalledTimes(1);
  });
}); 