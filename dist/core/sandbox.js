"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxPoolManager = void 0;
const uuid_1 = require("uuid");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(require('child_process').exec);
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
class SandboxPoolManager {
    activeSandboxes;
    pendingQueue;
    maxConcurrency;
    backend;
    constructor(config = {}) {
        this.activeSandboxes = new Map();
        this.pendingQueue = [];
        this.maxConcurrency = config.maxConcurrency || 5;
        this.backend = config.backend || 'docker';
    }
    /**
     * Provision a sandbox for an attempt
     */
    async provisionSandbox(attemptId, config) {
        const fullConfig = {
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
    async createSandbox(attemptId, config) {
        const sandboxId = (0, uuid_1.v4)();
        const sandbox = {
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
        }
        catch (error) {
            sandbox.state = 'failed';
            sandbox.error_message = error instanceof Error ? error.message : String(error);
            throw error;
        }
        return sandbox;
    }
    /**
     * Provision a Docker sandbox
     */
    async provisionDockerSandbox(sandbox) {
        const { config, sandbox_id } = sandbox;
        const containerName = `gorch-${sandbox_id}`;
        // Pull image if needed
        try {
            await execAsync(`docker pull ${config.image}`);
        }
        catch (error) {
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
    async provisionE2BSandbox(sandbox) {
        // For hackathon MVP, stub implementation
        // In production, use E2B SDK
        console.log('[SandboxPoolManager] E2B backend not implemented in MVP, using stub');
    }
    /**
     * Provision a Modal sandbox
     */
    async provisionModalSandbox(sandbox) {
        // For hackathon MVP, stub implementation
        // In production, use Modal SDK
        console.log('[SandboxPoolManager] Modal backend not implemented in MVP, using stub');
    }
    /**
     * Execute a command in a sandbox
     */
    async executeCommand(sandboxId, command, cwd) {
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
        }
        finally {
            if (sandbox.state === 'running') {
                sandbox.state = 'ready';
            }
        }
    }
    /**
     * Execute command in Docker sandbox
     */
    async executeDockerCommand(sandbox, command, cwd) {
        const containerName = `gorch-${sandbox.sandbox_id}`;
        const workDir = cwd || '/workspace';
        const dockerCommand = `docker exec ${containerName} sh -c "cd ${workDir} && ${command}"`;
        try {
            const { stdout, stderr } = await execAsync(dockerCommand, {
                timeout: sandbox.config.resource_limits.max_wall_time_ms,
            });
            return { stdout, stderr, exitCode: 0 };
        }
        catch (error) {
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
    async executeE2BCommand(sandbox, command, cwd) {
        // Stub for MVP
        return { stdout: '', stderr: 'E2B not implemented', exitCode: 1 };
    }
    /**
     * Execute command in Modal sandbox
     */
    async executeModalCommand(sandbox, command, cwd) {
        // Stub for MVP
        return { stdout: '', stderr: 'Modal not implemented', exitCode: 1 };
    }
    /**
     * Stream command output in real-time
     */
    async streamCommand(sandboxId, command, onOutput, cwd) {
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
            const process = (0, child_process_1.spawn)('docker', [
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
    async snapshotSandbox(sandboxId) {
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
    async snapshotDockerSandbox(sandbox) {
        const containerName = `gorch-${sandbox.sandbox_id}`;
        const snapshotName = `${containerName}-snapshot-${Date.now()}`;
        await execAsync(`docker commit ${containerName} ${snapshotName}`);
        return snapshotName;
    }
    /**
     * Restore sandbox from snapshot
     */
    async restoreSnapshot(sandboxId, snapshotName) {
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
    async restoreDockerSnapshot(sandbox, snapshotName) {
        const containerName = `gorch-${sandbox.sandbox_id}`;
        // Stop and remove current container
        await execAsync(`docker stop ${containerName}`).catch(() => { });
        await execAsync(`docker rm ${containerName}`).catch(() => { });
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
    async destroySandbox(sandboxId) {
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
        }
        catch (error) {
            console.error(`[SandboxPoolManager] Error destroying sandbox ${sandboxId}:`, error);
        }
        finally {
            this.activeSandboxes.delete(sandboxId);
            this.processQueue();
        }
    }
    /**
     * Destroy Docker sandbox
     */
    async destroyDockerSandbox(sandbox) {
        const containerName = `gorch-${sandbox.sandbox_id}`;
        await execAsync(`docker stop ${containerName}`).catch(() => { });
        await execAsync(`docker rm ${containerName}`).catch(() => { });
    }
    /**
     * Destroy E2B sandbox
     */
    async destroyE2BSandbox(sandbox) {
        // Stub for MVP
    }
    /**
     * Destroy Modal sandbox
     */
    async destroyModalSandbox(sandbox) {
        // Stub for MVP
    }
    /**
     * Process pending queue when capacity becomes available
     */
    processQueue() {
        while (this.pendingQueue.length > 0 && this.activeSandboxes.size < this.maxConcurrency) {
            const next = this.pendingQueue.shift();
            if (next) {
                this.createSandbox(next.attemptId, next.config)
                    .then(next.resolve)
                    .catch((error) => {
                    console.error(`[SandboxPoolManager] Failed to provision sandbox for ${next.attemptId}:`, error);
                    // Create failed sandbox to allow caller to handle error
                    const failedSandbox = {
                        sandbox_id: (0, uuid_1.v4)(),
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
    getSandbox(sandboxId) {
        return this.activeSandboxes.get(sandboxId);
    }
    /**
     * Get all active sandboxes
     */
    getActiveSandboxes() {
        return Array.from(this.activeSandboxes.values());
    }
    /**
     * Clean up all sandboxes (emergency shutdown)
     */
    async cleanup() {
        const sandboxIds = Array.from(this.activeSandboxes.keys());
        await Promise.all(sandboxIds.map(id => this.destroySandbox(id)));
    }
}
exports.SandboxPoolManager = SandboxPoolManager;
//# sourceMappingURL=sandbox.js.map