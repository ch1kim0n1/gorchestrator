import { GOrchestrator } from './core/orchestrator.js';

export interface GStackSDKOptions {
  apiKey?: string;
  gmirrorUrl?: string;
  gtomUrl?: string;
  gbrainPath?: string;
  maxAttempts?: number;
  sandbox?: 'inprocess' | 'docker';
}

export class GStackSDK {
  private orchestrator: GOrchestrator;

  constructor(options: GStackSDKOptions = {}) {
    this.orchestrator = new GOrchestrator({
      gmirrorEndpoint: options.gmirrorUrl,
      gtomEndpoint: options.gtomUrl,
      gbrainEndpoint: undefined,
      sandboxBackend: options.sandbox ?? 'inprocess',
    });
  }

  async run(task: string, opts?: { type?: string; maxAttempts?: number }) {
    return this.orchestrator.runTask({
      description: task,
      taskType: opts?.type ?? 'general',
      budget: { max_attempts: opts?.maxAttempts ?? 3, max_cost_usd: 5, max_wall_time_ms: 60_000 },
    });
  }
}

export { GOrchestrator };
