'use client';

import React from 'react';
import { VT323 } from "next/font/google";

const vt323 = VT323({ weight: "400", subsets: ["latin"] });

const SectorsPage: React.FC = () => {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className={`text-3xl font-bold text-white mb-2 ${vt323.className}`}>
          Sector Management
        </h1>
        <p className="text-gray-400 mb-8">
          Manage sector definitions and weights for the Lynx index
        </p>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-300">
            Sector management page coming soon...
          </p>
        </div>
      </div>
    </div>
  );
};

export default SectorsPage; 