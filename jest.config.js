// Use next/jest to automatically configure Jest for Next.js
const nextJest = require('next/jest');

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({
  dir: './',
});

// Any custom config you want to pass to Jest
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleNameMapper: {
    // Handle CSS imports
    '^.+\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    // Handle image imports
    '^.+\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
    // Explicitly mock the hedera-wallet-connect module
    '@hashgraph/hedera-wallet-connect': '<rootDir>/__mocks__/@hashgraph/hedera-wallet-connect.js'
  },
  // Important: Keep transformIgnorePatterns to handle non-ESM modules
  transformIgnorePatterns: [
    '/node_modules/(?!(@hashgraph/sdk))'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  collectCoverage: false,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config
module.exports = createJestConfig(customJestConfig); 