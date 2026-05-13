import * as crypto from 'crypto';
import { RubricFramework } from '../types/quality-rubric.js';

export const GORCHESTRATOR_RUBRIC_V1: RubricFramework = {
  name: 'gorchestrator_v1',
  version: '1.0',
  dimensions: [
    {
      name: 'correctness',
      description: 'Task completion accuracy and correctness',
      min: 0,
      max: 1,
      weight: 0.3,
      pass_floor: 0.5,
    },
    {
      name: 'latency',
      description: 'Response time performance (inverse of latency)',
      min: 0,
      max: 1,
      weight: 0.2,
      pass_floor: 0.5,
    },
    {
      name: 'robustness',
      description: 'Error handling and edge case resilience',
      min: 0,
      max: 1,
      weight: 0.2,
      pass_floor: 0.45,
    },
    {
      name: 'cost_efficiency',
      description: 'Cost per result (inverse of cost)',
      min: 0,
      max: 1,
      weight: 0.15,
      pass_floor: 0.3,
    },
    {
      name: 'resource_utilization',
      description: 'Efficient use of compute resources',
      min: 0,
      max: 1,
      weight: 0.15,
      pass_floor: 0.4,
    },
  ],
  overall_pass_criteria: {
    all_above_floor: true,
    weighted_mean_floor: 0.55,
  },
};

export function getRubricHash(rubric: RubricFramework): string {
  const str = JSON.stringify(rubric);
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  return hash.substring(0, 8);
}

// Cost hard gate: reject if cost exceeds budget
export function checkCostHardGate(costUsd: number, maxBudget: number): {
  passed: boolean;
  reason: string;
} {
  if (costUsd > maxBudget) {
    return {
      passed: false,
      reason: `Cost $${costUsd.toFixed(4)} exceeds budget $${maxBudget.toFixed(4)}`,
    };
  }
  return {
    passed: true,
    reason: `Cost $${costUsd.toFixed(4)} within budget $${maxBudget.toFixed(4)}`,
  };
}
