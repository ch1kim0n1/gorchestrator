/**
 * Custom error classes for GOrchestrator
 */

export class GOrchestratorError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'GOrchestratorError';
  }
}

export class BudgetExceededError extends GOrchestratorError {
  constructor(message: string) {
    super(message, 'BUDGET_EXCEEDED');
    this.name = 'BudgetExceededError';
  }
}
