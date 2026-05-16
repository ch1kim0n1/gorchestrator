import {
  Sandbox,
  SandboxConfig,
} from '../types/index.js';
import { coreLogger } from './observability.js';
import { LLMClient } from './llm-client.js';

/**
 * In-Process Sandbox Backend
 * 
 * Executes tasks directly via LLM calls without container isolation.
 * Used when Docker is unavailable or when MOCK_SANDBOX=1 is set.
 * 
 * This backend provides:
 * - No-op provisioning (no containers to spin up)
 * - Direct LLM execution for task prompts
 * - Cost tracking via LLM client
 * - Deterministic behavior for testing
 */
export class InProcessSandboxBackend {
  private llmClient: LLMClient;
  private agentConfig?: {
    model?: string;
    system_prompt?: string;
    temperature?: number;
  };

  constructor(config?: { agentConfig?: InProcessSandboxBackend['agentConfig'] }) {
    this.llmClient = new LLMClient();
    this.agentConfig = config?.agentConfig;
  }

  /**
   * Provision is a no-op for in-process mode
   */
  async provision(): Promise<void> {
    coreLogger.debug('In-process sandbox provision: no-op');
  }

  /**
   * Execute a task via direct LLM call
   */
  async execute(
    sandbox: Sandbox,
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number; cost_usd?: number }> {
    coreLogger.info('Executing task in-process', {
      sandboxId: sandbox.sandbox_id,
      commandLength: command.length,
    });

    try {
      const response = await this.llmClient.call(command, {
        model: this.agentConfig?.model || 'claude-sonnet-4-6',
        temperature: this.agentConfig?.temperature || 0.7,
        maxTokens: 4096,
      });

      return {
        stdout: response.content || '',
        stderr: '',
        exitCode: 0,
        cost_usd: response.cost_usd,
      };
    } catch (error) {
      coreLogger.error('In-process LLM execution failed', {
        sandboxId: sandbox.sandbox_id,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  /**
   * Destroy is a no-op for in-process mode
   */
  async destroy(): Promise<void> {
    coreLogger.debug('In-process sandbox destroy: no-op');
  }

  /**
   * Check if this backend is available (always true for in-process)
   */
  static async isAvailable(): Promise<boolean> {
    return true;
  }
}

/**
 * Helper to check if Docker is available
 * Runs 'docker info' with a 2-second timeout
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    const { spawn } = await import('child_process');
    
    return await new Promise<boolean>((resolve) => {
      const proc = spawn('docker', ['info']);
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        proc.kill();
        resolve(false);
      }, 2000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (!timedOut) {
          resolve(code === 0);
        }
      });

      proc.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}
