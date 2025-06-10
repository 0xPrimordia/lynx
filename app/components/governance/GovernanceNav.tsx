'use client';

import React from 'react';
import Link from 'next/link';
import { VT323 } from "next/font/google";

const vt323 = VT323({ weight: "400", subsets: ["latin"] });

interface GovernanceNavProps {
  currentSection: string;
}

const GovernanceNav: React.FC<GovernanceNavProps> = ({ currentSection }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', href: '/governance' },
    { id: 'composition', label: 'Composition', href: '/governance/composition' },
    { id: 'sectors', label: 'Sectors', href: '/governance/sectors' },
    { id: 'parameters', label: 'Parameters', href: '/governance/parameters' },
    { id: 'proposals', label: 'Proposals', href: '/governance/proposals' },
    { id: 'treasury', label: 'Treasury', href: '/governance/treasury' },
    { id: 'analytics', label: 'Analytics', href: '/governance/analytics' }
  ];

  return (
    <nav className="bg-gray-900/50 border-b border-gray-800 px-4 py-3">
      <div className="container mx-auto">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className={`text-white font-medium ${vt323.className}`}>Governance</span>
          </div>
          
          <div className="h-5 w-px bg-gray-600" />
          
          <div className="flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`text-sm transition-colors ${
                  currentSection === item.id
                    ? 'text-blue-400 font-medium'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default GovernanceNav; 