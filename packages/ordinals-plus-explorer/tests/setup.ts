import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { configure } from '@testing-library/dom';

// Configure testing-library
configure({
  testIdAttribute: 'data-testid',
});

// Mock any global browser APIs that aren't available in the test environment
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock fetch if needed
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Suppress specific console errors during tests
const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out React-specific warnings and errors that are expected during tests
  const ignoreMessages = [
    'Warning: ReactDOM.render is no longer supported',
    'Warning: useLayoutEffect does nothing on the server',
  ];
  
  if (args.some(arg => 
    typeof arg === 'string' && 
    ignoreMessages.some(msg => arg.includes(msg))
  )) {
    return;
  }
  
  originalConsoleError(...args);
}; 