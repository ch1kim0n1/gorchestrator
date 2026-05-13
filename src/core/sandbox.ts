import { v4 as uuidv4 } from 'uuid';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import {
  Sandbox,
  SandboxConfig,
  SandboxState,
} from '../types/index.js';

const execAsync = promisify(require('child_process').exec);

/**
 * Sandbox Pool Manager
 * 
 * Responsibilities:
 * - Provision isolated execution environments for each attempt
 * - Manage sandbox lifecycle (provision, run, snapshot, destroy)
 * - Handle concurrency limits and queueing
 * - Provide trace streaming capabilities
 * - Support multiple backends (Docker, E2B, Modal, etc.)
 */
export class SandboxPoolManager {
  private activeSandboxes: Map<string, Sandbox>;
  private pendingQueue: Array<{ attemptId: string; config: SandboxConfig; resolve: (s: Sandbox) => void }>;
  private maxConcurrency: number;
  private backend: SandboxConfig['backend'];
  private mockMode: boolean;

  constructor(config: {
    maxConcurrency?: number;
    backend?: SandboxConfig['backend'];
  } = {}) {
    this.activeSandboxes = new Map();
    this.pendingQueue = [];
    this.maxConcurrency = config.maxConcurrency || 5;
    this.backend = config.backend || 'docker';
    this.mockMode = process.env.MOCK_SANDBOX === '1';
  }

  /**
   * Provision a sandbox for an attempt
   */
  async provisionSandbox(
    attemptId: string,
    config?: Partial<SandboxConfig>
  ): Promise<Sandbox> {
    const fullConfig: SandboxConfig = {
      backend: this.backend,
      image: config?.image || 'node:20-alpine',
      resource_limits: config?.resource_limits || {
        cpu_cores: 2,
        memory_mb: 4096,
        disk_gb: 10,
        max_wall_time_ms: 300000,
      },
      network_isolation: config?.network_isolation ?? true,
      allowlisted_domains: config?.allowlisted_domains || [],
      snapshot_enabled: config?.snapshot_enabled ?? true,
    };

    // Check if we can provision immediately or need to queue
    if (this.activeSandboxes.size >= this.maxConcurrency) {
      return new Promise((resolve) => {
        this.pendingQueue.push({ attemptId, config: fullConfig, resolve });
      });
    }

    return this.createSandbox(attemptId, fullConfig);
  }

  /**
   * Create and start a sandbox
   */
  private async createSandbox(attemptId: string, config: SandboxConfig): Promise<Sandbox> {
    const sandboxId = uuidv4();
    const sandbox: Sandbox = {
      sandbox_id: sandboxId,
      config,
      state: 'provisioning',
      attempt_id: attemptId,
      created_at: new Date().toISOString(),
    };

    this.activeSandboxes.set(sandboxId, sandbox);

    try {
      switch (config.backend) {
        case 'docker':
          await this.provisionDockerSandbox(sandbox);
          break;
        case 'e2b':
          await this.provisionE2BSandbox(sandbox);
          break;
        case 'modal':
          await this.provisionModalSandbox(sandbox);
          break;
        default:
          throw new Error(`Unsupported backend: ${config.backend}`);
      }

      sandbox.state = 'ready';
      sandbox.started_at = new Date().toISOString();
    } catch (error) {
      sandbox.state = 'failed';
      sandbox.error_message = error instanceof Error ? error.message : String(error);
      throw error;
    }

    return sandbox;
  }

  /**
   * Provision a Docker sandbox
   */
  private async provisionDockerSandbox(sandbox: Sandbox): Promise<void> {
    if (this.mockMode) { return; }
    const { config, sandbox_id } = sandbox;
    const containerName = `gorch-${sandbox_id}`;

    // Pull image if needed
    try {
      await execAsync(`docker pull ${config.image}`);
    } catch (error) {
      // Image might already exist
    }

    // Create and start container
    const dockerArgs = [
      'run',
      '-d',
      '--name', containerName,
      '--cpus', String(config.resource_limits.cpu_cores),
      '--memory', `${config.resource_limits.memory_mb}m`,
      '--network', config.network_isolation ? 'none' : 'bridge',
      '-v', `${containerName}-work:/workspace`,
      config.image,
      'tail', '-f', '/dev/null', // Keep container running
    ];

    if (config.allowlisted_domains.length > 0) {
      // In production, set up network with allowlisted domains
      // For hackathon MVP, skip complex network config
    }

    await execAsync(`docker ${dockerArgs.join(' ')}`);
  }

  /**
   * Provision an E2B sandbox
   */
  private async provisionE2BSandbox(sandbox: Sandbox): Promise<void> {
    // For hackathon MVP, stub implementation
    // In production, use E2B SDK
    console.log('[SandboxPoolManager] E2B backend not implemented in MVP, using stub');
  }

  /**
   * Provision a Modal sandbox
   */
  private async provisionModalSandbox(sandbox: Sandbox): Promise<void> {
    // For hackathon MVP, stub implementation
    // In production, use Modal SDK
    console.log('[SandboxPoolManager] Modal backend not implemented in MVP, using stub');
  }

  /**
   * Execute a command in a sandbox
   */
  async executeCommand(
    sandboxId: string,
    command: string,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox not found: ${sandboxId}`);
    }

    if (sandbox.state !== 'ready' && sandbox.state !== 'running') {
      throw new Error(`Sandbox not ready: ${sandbox.state}`);
    }

    sandbox.state = 'running';

    try {
      switch (sandbox.config.backend) {
        case 'docker':
          return await this.executeDockerCommand(sandbox, command, cwd);
        case 'e2b':
          return await this.executeE2BCommand(sandbox, command, cwd);
        case 'modal':
          return await this.executeModalCommand(sandbox, command, cwd);
        default:
          throw new Error(`Unsupported backend: ${sandbox.config.backend}`);
      }
    } finally {
      if (sandbox.state === 'running') {
        sandbox.state = 'ready';
      }
    }
  }

  /**
   * Execute command in Docker sandbox
   */
  private async executeDockerCommand(
    sandbox: Sandbox,
    command: string,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (this.mockMode) {
      return { stdout: `[MOCK] ${command}`, stderr: '', exitCode: 0 };
    }
    const containerName = `gorch-${sandbox.sandbox_id}`;
    const workDir = cwd || '/workspace';
    
    const dockerCommand = `docker exec ${containerName} sh -c "cd ${workDir} && ${command}"`;
    
    try {
      const { stdout, stderr } = await execAsync(dockerCommand, {
        timeout: sandbox.config.resource_limits.max_wall_time_ms,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
      };
    }
  }

  /**
   * Execute command in E2B sandbox
   */
  private async executeE2BCommand(
    sandbox: Sandbox,
    command: string,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Stub for MVP
    return { stdout: '', stderr: 'E2B not implemented', exitCode: 1 };
  }

  /**
   * Execute command in Modal sandbox
   */
  private async executeModalCommand(
    sandbox: Sandbox,
    command: string,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Stub for MVP
    return { stdout: '', stderr: 'Modal not implemented', exitCode: 1 };
  }

  /**
   * Stream command output in real-time
   */
  async streamCommand(
    sandboxId: string,
    command: string,
    onOutput: (stdout: string, stderr: string) => void,
    cwd?: string
  ): Promise<number> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox not found: ${sandboxId}`);
    }

    if (sandbox.config.backend !== 'docker') {
      // Fall back to non-streaming for non-Docker backends
      const result = await this.executeCommand(sandboxId, command, cwd);
      onOutput(result.stdout, result.stderr);
      return result.exitCode;
    }

    const containerName = `gorch-${sandbox.sandbox_id}`;
    const workDir = cwd || '/workspace';
    
    return new Promise((resolve, reject) => {
      const process = spawn('docker', [
        'exec', containerName, 'sh', '-c', `cd ${workDir} && ${command}`
      ]);

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data;
        onOutput(data.toString(), '');
      });

      process.stderr?.on('data', (data) => {
        stderr += data;
        onOutput('', data.toString());
      });

      process.on('close', (code) => {
        resolve(code || 0);
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Create a snapshot of sandbox state
   */
  async snapshotSandbox(sandboxId: string): Promise<string> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox not found: ${sandboxId}`);
    }

    if (!sandbox.config.snapshot_enabled) {
      throw new Error('Snapshots not enabled for this sandbox');
    }

    switch (sandbox.config.backend) {
      case 'docker':
        return await this.snapshotDockerSandbox(sandbox);
      default:
        throw new Error(`Snapshots not supported for backend: ${sandbox.config.backend}`);
    }
  }

  /**
   * Snapshot Docker sandbox
   */
  private async snapshotDockerSandbox(sandbox: Sandbox): Promise<string> {
    if (this.mockMode) { return `mock-snapshot-${sandbox.sandbox_id}`; }
    const containerName = `gorch-${sandbox.sandbox_id}`;
    const snapshotName = `${containerName}-snapshot-${Date.now()}`;
    
    await execAsync(`docker commit ${containerName} ${snapshotName}`);
    return snapshotName;
  }

  /**
   * Restore sandbox from snapshot
   */
  async restoreSnapshot(sandboxId: string, snapshotName: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox not found: ${sandboxId}`);
    }

    switch (sandbox.config.backend) {
      case 'docker':
        await this.restoreDockerSnapshot(sandbox, snapshotName);
        break;
      default:
        throw new Error(`Snapshots not supported for backend: ${sandbox.config.backend}`);
    }
  }

  /**
   * Restore Docker sandbox from snapshot
   */
  private async restoreDockerSnapshot(sandbox: Sandbox, snapshotName: string): Promise<void> {
    if (this.mockMode) { return; }
    const containerName = `gorch-${sandbox.sandbox_id}`;
    
    // Stop and remove current container
    await execAsync(`docker stop ${containerName}`).catch(() => {});
    await execAsync(`docker rm ${containerName}`).catch(() => {});
    
    // Create new container from snapshot
    const dockerArgs = [
      'run',
      '-d',
      '--name', containerName,
      '--cpus', String(sandbox.config.resource_limits.cpu_cores),
      '--memory', `${sandbox.config.resource_limits.memory_mb}m`,
      snapshotName,
      'tail', '-f', '/dev/null',
    ];
    
    await execAsync(`docker ${dockerArgs.join(' ')}`);
  }

  /**
   * Destroy a sandbox
   */
  async destroySandbox(sandboxId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(sandboxId);
    if (!sandbox) {
      return; // Already destroyed
    }

    sandbox.state = 'destroyed';
    sandbox.completed_at = new Date().toISOString();

    try {
      switch (sandbox.config.backend) {
        case 'docker':
          await this.destroyDockerSandbox(sandbox);
          break;
        case 'e2b':
          await this.destroyE2BSandbox(sandbox);
          break;
        case 'modal':
          await this.destroyModalSandbox(sandbox);
          break;
      }
    } catch (error) {
      console.error(`[SandboxPoolManager] Error destroying sandbox ${sandboxId}:`, error);
    } finally {
      this.activeSandboxes.delete(sandboxId);
      this.processQueue();
    }
  }

  /**
   * Destroy Docker sandbox
   */
  private async destroyDockerSandbox(sandbox: Sandbox): Promise<void> {
    if (this.mockMode) return;
    const containerName = `gorch-${sandbox.sandbox_id}`;

    await execAsync(`docker stop ${containerName}`).catch(() => {});
    await execAsync(`docker rm ${containerName}`).catch(() => {});
  }

  /**
   * Destroy E2B sandbox
   */
  private async destroyE2BSandbox(sandbox: Sandbox): Promise<void> {
    // Stub for MVP
  }

  /**
   * Destroy Modal sandbox
   */
  private async destroyModalSandbox(sandbox: Sandbox): Promise<void> {
    // Stub for MVP
  }

  /**
   * Process pending queue when capacity becomes available
   */
  private processQueue(): void {
    while (this.pendingQueue.length > 0 && this.activeSandboxes.size < this.maxConcurrency) {
      const next = this.pendingQueue.shift();
      if (next) {
        this.createSandbox(next.attemptId, next.config)
          .then(next.resolve)
          .catch((error) => {
            console.error(`[SandboxPoolManager] Failed to provision sandbox for ${next.attemptId}:`, error);
            // Create failed sandbox to allow caller to handle error
            const failedSandbox: Sandbox = {
              sandbox_id: uuidv4(),
              config: next.config,
              state: 'failed',
              attempt_id: next.attemptId,
              created_at: new Date().toISOString(),
              error_message: error instanceof Error ? error.message : String(error),
            };
            next.resolve(failedSandbox);
          });
      }
    }
  }

  /**
   * Get sandbox status
   */
  getSandbox(sandboxId: string): Sandbox | undefined {
    return this.activeSandboxes.get(sandboxId);
  }

  /**
   * Get all active sandboxes
   */
  getActiveSandboxes(): Sandbox[] {
    return Array.from(this.activeSandboxes.values());
  }

  /**
   * Get pool statistics
   */
  getStats(): { active: number; queued: number; maxConcurrency: number } {
    return {
      active: this.activeSandboxes.size,
      queued: this.pendingQueue.length,
      maxConcurrency: this.maxConcurrency,
    };
  }

  /**
   * Clean up all sandboxes (emergency shutdown)
   */
  async cleanup(): Promise<void> {
    const sandboxIds = Array.from(this.activeSandboxes.keys());
    await Promise.all(sandboxIds.map(id => this.destroySandbox(id)));
  }
}
