/**
 * GOrchestrator HTTP client
 *
 * GOrchestrator exposes only a health server (port 8080) and runs via MCP.
 * This client targets the health endpoints.
 */

export interface TaskInput {
  description: string;
  taskType?: string;
  surfaces?: string[];
  constraints?: string[];
  budget?: { max_cost_usd?: number; max_latency_ms?: number };
  userContext?: string;
  companyContext?: string;
  n?: number;
  verify?: boolean;
  cognitiveCheck?: boolean;
  priority?: 'normal' | 'high' | 'critical';
}

export interface TaskResult {
  task_id: string;
  output: string;
  tier_used?: string;
  consensus_decision?: string;
  cost_usd?: number;
  [key: string]: unknown;
}

export interface HealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  [key: string]: unknown;
}

export interface DriftStat {
  metric: string;
  value: number;
  window?: string;
  recorded_at?: string;
  [key: string]: unknown;
}

export interface CostStats {
  total_usd: number;
  committed_usd: number;
  reserved_usd: number;
  [key: string]: unknown;
}

export class GOrchestratorClient {
  private baseUrl: string;
  private healthBaseUrl: string;
  private token?: string;

  constructor(options: { baseUrl?: string; healthBaseUrl?: string; token?: string } = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:3001';
    this.healthBaseUrl = options.healthBaseUrl ?? 'http://localhost:8080';
    this.token = options.token;
  }

  /** POST to execute a task (if an HTTP task endpoint is present) */
  async runTask(input: TaskInput): Promise<TaskResult> {
    return this.request<TaskResult>('POST', '/task', input, this.baseUrl);
  }

  /** GET health/liveness status */
  async health(): Promise<HealthResult> {
    return this.request<HealthResult>('GET', '/health/live', undefined, this.healthBaseUrl);
  }

  /** GET drift statistics */
  async getDrift(metricName?: string): Promise<DriftStat[]> {
    const qs = metricName ? `?metric=${encodeURIComponent(metricName)}` : '';
    return this.request<DriftStat[]>('GET', `/drift${qs}`, undefined, this.baseUrl);
  }

  /** GET cost statistics */
  async getCostStats(): Promise<CostStats> {
    return this.request<CostStats>('GET', '/cost', undefined, this.baseUrl);
  }

  private async request<T>(method: string, path: string, body?: unknown, base?: string): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${base ?? this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }
}
