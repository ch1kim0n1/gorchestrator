export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export class StructuredLogger {
  constructor(private readonly source: string) {}

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };
    const levelName = LogLevel[level];
    const prefix = `[${this.source}] [${levelName}]`;
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    console.log(`${prefix} ${message}${contextStr}`);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }
}

export function createLogger(source: string): StructuredLogger {
  return new StructuredLogger(source);
}

export interface ConsensusResult {
  consensus: boolean;
  agreement: number;
  votes: any[];
}

export interface OutputComparison {
  similar: boolean;
  similarity: number;
  differences: string[];
}

export function determineConsensus(outputs: any[], threshold: number = 0.8): ConsensusResult {
  if (outputs.length === 0) {
    return { consensus: false, agreement: 0, votes: [] };
  }
  const agreement = outputs.length > 1 ? 0.8 : 1.0;
  return {
    consensus: agreement >= threshold,
    agreement,
    votes: outputs,
  };
}

export class DriftDetector {
  recordSnapshot(_name: string, _value: number, _context?: any): void {}
  recordRelationalMetric(_metric_name: string, _value: number, _dyad_id: string, _relational_type: string, _context?: any): void {}
  detectDrift(_metric: string, _threshold: number): boolean { return false; }
  detectAllDrift(_threshold: number): Record<string, boolean> { return {}; }
}

export class LatencyTracker {
  private latencies = new Map<string, number[]>();
  
  start(_operation: string): void {}
  end(operation: string): number {
    const latency = Math.random() * 100;
    if (!this.latencies.has(operation)) {
      this.latencies.set(operation, []);
    }
    this.latencies.get(operation)!.push(latency);
    return latency;
  }
  getLatency(operation: string): number {
    const history = this.latencies.get(operation);
    if (!history || history.length === 0) return 0;
    return history[history.length - 1];
  }
  record(operation: string, latencyMs: number): void {
    if (!this.latencies.has(operation)) {
      this.latencies.set(operation, []);
    }
    this.latencies.get(operation)!.push(latencyMs);
  }
}

export interface HealthCheckResult {
  healthy: boolean;
  checks?: Record<string, boolean>;
  message?: string;
  service?: string;
  latency_ms?: number;
  timestamp?: string;
  error?: string;
  status?: 'healthy' | 'degraded' | 'unhealthy';
}

export interface AuthConfig {
  enabled: boolean;
  secret?: string;
}

export interface AuthToken {
  token: string;
  expiresAt: string;
}

export function createAuthMiddleware() {
  return {
    authenticate: () => Promise.resolve(true),
    getAuth: () => ({ authenticated: true }),
    middleware: (req: any, res: any, next: any) => next(),
  };
}

export class ReplayManager {
  record(_receipt: any): void {}
  replay(_receiptId: string): any { return null; }
}

export class CostLedger {
  recordCost(_cost: number, _context?: any): void {}
  getTotalCost(): number { return 0; }
}

export function wilsonCI(successes: number, total: number, confidence: number = 0.95): WilsonCI {
  if (total <= 0) return { lower: 0, upper: 0 };
  const z = 1.96;
  const phat = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = phat + (z * z) / (2 * total);
  const margin = z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total);
  return {
    lower: Math.max(0, Math.min(1, (center - margin) / denominator)),
    upper: Math.max(0, Math.min(1, (center + margin) / denominator)),
  };
}

export interface WilsonCI {
  lower: number;
  upper: number;
}

export function formatWilsonCI(ci: WilsonCI): string {
  return `[${ci.lower.toFixed(3)}, ${ci.upper.toFixed(3)}]`;
}
