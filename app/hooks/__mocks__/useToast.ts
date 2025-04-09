// Mock implementation of the useToast hook
export const useToast = jest.fn().mockReturnValue({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    loading: jest.fn()
  }
});

export default useToast; 