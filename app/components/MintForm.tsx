import React, { useState, useEffect } from 'react';
import { useTokens } from '../hooks/useTokens';
import { useTokenQueue } from '../hooks/useTokenQueue';
import { useToast } from '../hooks/useToast';
import { useWallet } from '../hooks/useWallet';
import { Button } from '@nextui-org/button';
import { Card, CardBody, CardHeader, CardFooter } from '@nextui-org/card';
import { Input } from '@nextui-org/input';
import { Progress } from '@nextui-org/progress';
import { Spinner } from '@nextui-org/spinner';
import { Tooltip } from '@nextui-org/tooltip';

// Add type for mint parameters
interface MintParams {
  lynxAmount: number;
  onSuccess: (txId: string) => void;
  onError: (error: Error) => void;
}

export function MintForm() {
  const { toast } = useToast();
  const { tokenBalances, requiredTokens, calculateRequiredTokens } = useTokens();
  const { 
    queueTokenApproval,
    mintLynx,
    getTransactionStatus, 
    queueStats,
    isProcessing,
    getTokenRatios
  } = useTokenQueue();
  const { isConnected } = useWallet();
  
  const [lynxAmount, setLynxAmount] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [mintTxId, setMintTxId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Calculate token requirements based on LYNX amount
  const required = calculateRequiredTokens(lynxAmount);
  
  // Check transaction status regularly
  useEffect(() => {
    if (!isSubmitting || !mintTxId) return;
    
    const interval = setInterval(() => {
      const txStatus = getTransactionStatus(mintTxId);
      
      if (txStatus?.status === 'completed') {
        toast.success(`Successfully minted ${lynxAmount} LYNX tokens!`);
        setIsSubmitting(false);
        setCurrentStep('');
        setError(null);
        clearInterval(interval);
      } else if (txStatus?.status === 'failed') {
        const errorMessage = txStatus.error?.message || 'Unknown error';
        toast.error(`Failed to mint LYNX: ${errorMessage}`);
        setIsSubmitting(false);
        setCurrentStep('');
        setError(errorMessage);
        clearInterval(interval);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [mintTxId, isSubmitting, getTransactionStatus, toast, lynxAmount]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (isSubmitting || isProcessing) {
      toast.info('Please wait for current transactions to complete');
      return;
    }
    
    if (lynxAmount <= 0) {
      toast.error('Please enter a valid amount of LYNX to mint');
      return;
    }
    
    if (!isConnected || !mintLynx) {
      toast.error('Wallet is not connected');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setCurrentStep('Initializing mint process');
    toast.loading('Starting mint process...');
    
    try {
      // Queue the mint process, which will handle token approvals and associations
      setCurrentStep('Checking token associations');
      toast.info('Checking and ensuring token associations...');
      
      const result = await mintLynx({
        lynxAmount,
        onSuccess: (txId: string) => {
          toast.success(`Mint transaction submitted: ${txId}`);
          setCurrentStep('LYNX minting transaction submitted');
        },
        onError: (error: Error) => {
          console.error('Mint error:', error);
          toast.error(`Mint error: ${error.message}`);
          setError(error.message);
          setIsSubmitting(false);
          setCurrentStep('');
        }
      });
      
      // Store mint transaction ID
      setMintTxId(result.mintId);
      
      // Set current step to inform user
      setCurrentStep('Processing token approvals');
      toast.info('Token approvals and mint transactions queued');
      
      // Monitor approval statuses
      const checkApprovals = setInterval(() => {
        const sauceStatus = getTransactionStatus(result.sauceApprovalId);
        const clxyStatus = getTransactionStatus(result.clxyApprovalId);
        const mintStatus = getTransactionStatus(result.mintId);
        
        if (sauceStatus?.status === 'processing') {
          setCurrentStep('Processing SAUCE approval');
        } else if (clxyStatus?.status === 'processing') {
          setCurrentStep('Processing CLXY approval');
        } else if (mintStatus?.status === 'processing') {
          setCurrentStep('Processing LYNX mint');
        }
        
        // Clear interval when everything is done or failed
        if (
          (sauceStatus?.status === 'failed') || 
          (clxyStatus?.status === 'failed') || 
          (mintStatus?.status === 'completed') || 
          (mintStatus?.status === 'failed')
        ) {
          clearInterval(checkApprovals);
        }
      }, 500);
      
    } catch (error) {
      console.error('Error queueing mint:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide more helpful error messages for association failures
      if (errorMessage.includes('Failed to associate')) {
        toast.error('Token association failed. Please try again or associate tokens manually.');
      } else {
        toast.error(`Failed to queue mint: ${errorMessage}`);
      }
      
      setError(errorMessage);
      setIsSubmitting(false);
      setCurrentStep('');
    }
  };
  
  // Display progress based on queue stats
  const progress = queueStats.totalTransactions > 0
    ? Math.round((queueStats.completedTransactions / queueStats.totalTransactions) * 100)
    : 0;
  
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="flex gap-3">
        <div className="flex flex-col">
          <p className="text-md">Mint LYNX Tokens</p>
          <p className="text-small text-default-500">Exchange SAUCE and CLXY for LYNX</p>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            <Input
              type="number"
              label="Amount"
              placeholder="0"
              min={1}
              value={lynxAmount.toString()}
              onChange={(e) => setLynxAmount(parseInt(e.target.value) || 0)}
              disabled={isSubmitting || isProcessing}
              endContent={
                <div className="pointer-events-none flex items-center">
                  <span className="text-default-400 text-small">LYNX</span>
                </div>
              }
            />
            
            <div className="p-3 bg-gray-800 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Required Tokens:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500">HBAR:</div>
                <div className="font-medium">{required.HBAR} HBAR</div>
                <div className="text-gray-500">SAUCE:</div>
                <div className="font-medium">{required.SAUCE} SAUCE</div>
                <div className="text-gray-500">CLXY:</div>
                <div className="font-medium">{required.CLXY} CLXY</div>
              </div>
            </div>
          </div>
        </form>
      </CardBody>
      <CardFooter className="flex flex-col gap-3">
        {isSubmitting && (
          <div className="w-full">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">
                {queueStats.completedTransactions} of {queueStats.totalTransactions} completed
                {queueStats.failedTransactions > 0 && 
                  ` (${queueStats.failedTransactions} failed)`
                }
              </span>
              <span className="text-sm font-medium">
                {progress}%
              </span>
            </div>
            <Progress 
              value={progress} 
              className="mt-1"
              color={progress === 100 ? "success" : "primary"}
              aria-label="Mint transaction progress"
            />
            
            {currentStep && (
              <div className="mt-2 text-sm text-center text-gray-400">
                {currentStep}
                {currentStep.includes('Checking token associations') && (
                  <div className="mt-1 text-xs text-blue-400">
                    If tokens are not associated, they will be associated automatically.
                    This may take a few moments.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {error && !isSubmitting && (
          <div className="w-full p-2 mb-2 bg-red-900/20 border border-red-800 rounded-md">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
        
        <div className="w-full">
          {isSubmitting ? (
            <Button color="primary" variant="flat" className="w-full" disabled>
              <Spinner size="sm" color="current" />
              <span className="ml-2">Processing...</span>
            </Button>
          ) : (
            <Button
              color="primary"
              onClick={handleSubmit}
              disabled={
                !isConnected || 
                isSubmitting || 
                isProcessing || 
                Number(tokenBalances.SAUCE) < required.SAUCE ||
                Number(tokenBalances.CLXY) < required.CLXY ||
                Number(tokenBalances.HBAR) < required.HBAR
              }
              className="w-full"
            >
              Mint
            </Button>
          )}
          
          {!isConnected && (
            <div className="text-xs text-center text-gray-500">
              Please connect your wallet to mint tokens
            </div>
          )}
          
          {!isSubmitting && !error && (
            <div className="mt-2 text-xs text-center text-gray-400">
              Note: You will need to approve SAUCE and CLXY tokens before minting
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
} 