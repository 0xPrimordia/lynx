'use client';

import React from 'react';

const TestnetAlert: React.FC = () => {
  return (
    <div className="bg-orange-900/30 border border-orange-800 text-orange-200 px-4 py-3 rounded-lg mb-4">
      <div className="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.662-.833-2.432 0L4.382 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span className="font-medium">Testnet Mode:</span>
        <span className="ml-1">You are currently using the Hedera testnet</span>
      </div>
    </div>
  );
};

export default TestnetAlert; 