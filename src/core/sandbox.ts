import { v4 as uuidv4 } from 'uuid';
import { spawn, ChildProcess } from 'child_process';
import {
  Sandbox,
  SandboxConfig,
  SandboxState,
} from '../types/index.js';
import { coreLogger } from './observability.js';
import {
  sanitizeCliPath,
  sanitizeCliString,
  sanitizeDockerImage,
  sanitizeDomainName,
  sanitizeContainerName,
  sanitizeResourceLimit,
} from './security.js';
import { InProcessSandboxBackend, isDockerAvailable } from './sandbox-inprocess.js';

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
  private inProcessBackend: InProcessSandboxBackend;

  constructor(config: {
    maxConcurrency?: number;
    backend?: SandboxConfig['backend'];
  } = {}) {
    this.activeSandboxes = new Map();
    this.pendingQueue = [];
    this.maxConcurrency = config.maxConcurrency || 5;
    this.mockMode = process.env.MOCK_SANDBOX === '1';
    
    // Auto-detect backend: use config if provided, otherwise check Docker availability
    const configBackend = config.backend || process.env.SANDBOX_BACKEND as SandboxConfig['backend'];
    if (configBackend) {
      this.backend = configBackend;
    } else {
      this.backend = 'docker'; // Default to docker, will fall back to inprocess if unavailable
    }
    
    this.inProcessBackend = new InProcessSandboxBackend();
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
        case 'inprocess':
          await this.provisionInProcessSandbox(sandbox);
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
    if (this.mockMode) {
      // Mock mode uses in-process backend for real LLM calls
      await this.inProcessBackend.provision();
      return;
    }
    const { config, sandbox_id } = sandbox;
    const containerName = sanitizeContainerName(`gorch-${sandbox_id}`, 'container name');
    const safeImage = sanitizeDockerImage(config.image, 'Docker image');

    // Sanitize resource limits
    const cpuCores = sanitizeResourceLimit(config.resource_limits.cpu_cores, 'CPU cores', 1, 64);
    const memoryMb = sanitizeResourceLimit(config.resource_limits.memory_mb, 'memory', 128, 65536);

    // Pull image if needed - use array-form arguments to prevent shell injection
    try {
      await this.execSafe('docker', ['pull', safeImage]);
    } catch (error) {
      // Image might already exist
    }

    // Create and start container - use array-form arguments
    const dockerArgs = [
      'docker',
      'run',
      '-d',
      '--name', containerName,
      '--cpus', String(cpuCores),
      '--memory', `${memoryMb}m`,
      '--network', config.network_isolation ? 'none' : 'bridge',
      '-v', `${containerName}-work:/workspace`,
      safeImage,
      'tail', '-f', '/dev/null', // Keep container running
    ];

    await this.execSafe(dockerArgs[0], dockerArgs.slice(1));

    // Apply network restrictions if allowlisted domains are specified
    if (config.allowlisted_domains.length > 0) {
      await this.applyNetworkRestrictions(containerName, config.allowlisted_domains);
    }
  }

  /**
   * Execute command safely with array-form arguments (no shell interpolation)
   */
  private async execSafe(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(`Command failed with code ${code}: ${stderr}`) as Error & {
            stdout?: string;
            stderr?: string;
            code?: number | null;
          };
          error.stdout = stdout;
          error.stderr = stderr;
          error.code = code;
          reject(error);
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Apply network restrictions using iptables to allow only allowlisted domains
   */
  private async applyNetworkRestrictions(containerName: string, allowlistedDomains: string[]): Promise<void> {
    if (this.mockMode) {
      // Mock mode skips network restrictions (in-process has no container)
      return;
    }

    // Sanitize all domains in the allowlist
    const safeDomains = allowlistedDomains.map(domain =>
      sanitizeDomainName(domain, 'allowlisted domain')
    );

    try {
      // Flush existing iptables rules in OUTPUT chain
      await this.execSafe('docker', ['exec', containerName, 'iptables', '-F', 'OUTPUT']);

      // Set default policy to DROP for OUTPUT chain
      await this.execSafe('docker', ['exec', containerName, 'iptables', '-P', 'OUTPUT', 'DROP']);

      // Allow DNS (UDP port 53)
      await this.execSafe('docker', ['exec', containerName, 'iptables', '-A', 'OUTPUT', '-p', 'udp', '--dport', '53', '-j', 'ACCEPT']);
      await this.execSafe('docker', ['exec', containerName, 'iptables', '-A', 'OUTPUT', '-p', 'tcp', '--dport', '53', '-j', 'ACCEPT']);

      // Allow loopback
      await this.execSafe('docker', ['exec', containerName, 'iptables', '-A', 'OUTPUT', '-i', 'lo', '-j', 'ACCEPT']);

      // Allow traffic to allowlisted domains
      for (const domain of safeDomains) {
        // Note: This is a simplified implementation. In production, you would:
        // 1. Resolve domain to IP addresses
        // 2. Add rules for each IP
        // 3. Set up DNS resolution blocking
        // For MVP, we allow the domain by using a simple accept rule
        // This requires the container to have iptables with string matching support
        try {
          await this.execSafe('docker', [
            'exec', containerName,
            'iptables', '-A', 'OUTPUT',
            '-d', domain,
            '-j', 'ACCEPT'
          ]);
        } catch (error) {
          // If domain-based rule fails, log but continue
          coreLogger.warn('Could not add sandbox network rule for domain', {
            domain,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      coreLogger.error('Failed to apply sandbox network restrictions', {
        containerName,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the whole sandbox provisioning if network restrictions fail
    }
  }

  /**
   * Provision an E2B sandbox
   */
  private async provisionE2BSandbox(sandbox: Sandbox): Promise<void> {
    coreLogger.info('E2B backend requires additional setup - see TESTING.md for implementation guidance');
  }

  /**
   * Provision a Modal sandbox
   */
  private async provisionModalSandbox(sandbox: Sandbox): Promise<void> {
    coreLogger.info('Modal backend requires additional setup - see TESTING.md for implementation guidance');
  }

  /**
   * Provision an in-process sandbox (no-op, just marks as ready)
   */
  private async provisionInProcessSandbox(sandbox: Sandbox): Promise<void> {
    await this.inProcessBackend.provision();
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
        case 'inprocess':
          return await this.executeInProcessCommand(sandbox, command, cwd);
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
      // Mock mode uses in-process backend for real LLM calls
      const result = await this.inProcessBackend.execute(sandbox, command);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    }
    const containerName = sanitizeContainerName(`gorch-${sandbox.sandbox_id}`, 'container name');
    const dockerArgs = this.buildDockerExecArgs(containerName, command, cwd);
        
    try {
      const { stdout, stderr } = await this.execSafe('docker', dockerArgs);
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
   * Execute command in in-process sandbox (direct LLM call)
   */
  private async executeInProcessCommand(
    sandbox: Sandbox,
    command: string,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const result = await this.inProcessBackend.execute(sandbox, command);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
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

    const containerName = sanitizeContainerName(`gorch-${sandbox.sandbox_id}`, 'container name');
    const dockerArgs = this.buildDockerExecArgs(containerName, command, cwd);

    return new Promise((resolve, reject) => {
      const process = spawn('docker', dockerArgs);

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
    if (this.mockMode) {
      // Mock mode returns a mock snapshot ID (in-process has no container to snapshot)
      return `mock-snapshot-${sandbox.sandbox_id}`;
    }
    const containerName = `gorch-${sandbox.sandbox_id}`;
    const snapshotName = `${containerName}-snapshot-${Date.now()}`;
    
    await this.execSafe('docker', ['commit', containerName, snapshotName]);
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
    const containerName = sanitizeContainerName(`gorch-${sandbox.sandbox_id}`, 'container name');

    // Sanitize resource limits
    const cpuCores = sanitizeResourceLimit(sandbox.config.resource_limits.cpu_cores, 'CPU cores', 1, 64);
    const memoryMb = sanitizeResourceLimit(sandbox.config.resource_limits.memory_mb, 'memory', 128, 65536);

    // Stop and remove current container - use array-form arguments
    await this.execSafe('docker', ['stop', containerName]).catch(() => {});
    await this.execSafe('docker', ['rm', containerName]).catch(() => {});

    // Create new container from snapshot - use array-form arguments
    const dockerArgs = [
      'run',
      '-d',
      '--name', containerName,
      '--cpus', String(cpuCores),
      '--memory', `${memoryMb}m`,
      '--network', sandbox.config.network_isolation ? 'none' : 'bridge',
      snapshotName,
      'tail', '-f', '/dev/null',
    ];

    await this.execSafe(dockerArgs[0], dockerArgs.slice(1));
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
        case 'inprocess':
          await this.destroyInProcessSandbox(sandbox);
          break;
      }
    } catch (error) {
      coreLogger.error('Error destroying sandbox', {
        sandboxId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.activeSandboxes.delete(sandboxId);
      this.processQueue();
    }
  }

  /**
   * Destroy Docker sandbox
   */
  private async destroyDockerSandbox(sandbox: Sandbox): Promise<void> {
    if (this.mockMode) {
      // Mock mode uses in-process backend destroy (no-op)
      await this.inProcessBackend.destroy();
      return;
    }
    const containerName = sanitizeContainerName(`gorch-${sandbox.sandbox_id}`, 'container name');

    await this.execSafe('docker', ['stop', containerName]).catch(() => {});
    await this.execSafe('docker', ['rm', containerName]).catch(() => {});
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
   * Destroy in-process sandbox (no-op)
   */
  private async destroyInProcessSandbox(sandbox: Sandbox): Promise<void> {
    await this.inProcessBackend.destroy();
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
            coreLogger.error('Failed to provision sandbox', {
              attemptId: next.attemptId,
              error: error instanceof Error ? error.message : String(error),
            });
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

  private buildDockerExecArgs(containerName: string, command: string, cwd?: string): string[] {
    const workDir = sanitizeCliPath(cwd || '/workspace', 'sandbox cwd');
    const safeCommand = sanitizeCliString(command, 'sandbox command', 20000);
    return [
      'exec',
      '-w', workDir,
      containerName,
      'sh',
      '-lc',
      safeCommand,
    ];
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
