/**
 * Global test setup for GOrchestrator
 */

import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MOCK_SANDBOX = '1';

// Mock external services
jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: 'Test response' }],
        usage: { input_tokens: 10, output_tokens: 20 }
      })
    }
  }))
}));

// Increase timeout for integration tests
jest.setTimeout(30000);

// Setup global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
