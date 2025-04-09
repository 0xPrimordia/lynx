import { toast as sonnerToast } from "sonner";

// Stub implementation for TypeScript to recognize the hook
// The actual implementation would be more detailed

export interface ToastFunctions {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  loading: (message: string) => void;
}

export interface UseToastResult {
  toast: ToastFunctions;
}

export function useToast(): UseToastResult {
  const toast: ToastFunctions = {
    success: (message: string) => sonnerToast.success(message),
    error: (message: string) => sonnerToast.error(message),
    info: (message: string) => sonnerToast.info(message),
    warning: (message: string) => sonnerToast.warning(message),
    loading: (message: string) => sonnerToast.loading(message),
  };

  return { toast };
}

export default useToast; 