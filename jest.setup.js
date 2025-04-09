// Import jest-dom for DOM element assertions
require('@testing-library/jest-dom');

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      prefetch: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
    };
  },
  usePathname() {
    return '';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock next/image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    const React = require('react');
    // eslint-disable-next-line
    return React.createElement('img', props);
  },
}));

// Mock Next.js font
jest.mock('next/font/google', () => ({
  VT323: () => ({
    className: 'mocked-font',
    style: { fontFamily: 'mocked-font' }
  })
}));

// Add TextEncoder/TextDecoder globals for Node.js environment
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
}); 