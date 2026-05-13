import { Sandbox, SandboxConfig } from '../types/index.js';
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
export declare class SandboxPoolManager {
    private activeSandboxes;
    private pendingQueue;
    private maxConcurrency;
    private backend;
    constructor(config?: {
        maxConcurrency?: number;
        backend?: SandboxConfig['backend'];
    });
    /**
     * Provision a sandbox for an attempt
     */
    provisionSandbox(attemptId: string, config?: Partial<SandboxConfig>): Promise<Sandbox>;
    /**
     * Create and start a sandbox
     */
    private createSandbox;
    /**
     * Provision a Docker sandbox
     */
    private provisionDockerSandbox;
    /**
     * Provision an E2B sandbox
     */
    private provisionE2BSandbox;
    /**
     * Provision a Modal sandbox
     */
    private provisionModalSandbox;
    /**
     * Execute a command in a sandbox
     */
    executeCommand(sandboxId: string, command: string, cwd?: string): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
    }>;
    /**
     * Execute command in Docker sandbox
     */
    private executeDockerCommand;
    /**
     * Execute command in E2B sandbox
     */
    private executeE2BCommand;
    /**
     * Execute command in Modal sandbox
     */
    private executeModalCommand;
    /**
     * Stream command output in real-time
     */
    streamCommand(sandboxId: string, command: string, onOutput: (stdout: string, stderr: string) => void, cwd?: string): Promise<number>;
    /**
     * Create a snapshot of sandbox state
     */
    snapshotSandbox(sandboxId: string): Promise<string>;
    /**
     * Snapshot Docker sandbox
     */
    private snapshotDockerSandbox;
    /**
     * Restore sandbox from snapshot
     */
    restoreSnapshot(sandboxId: string, snapshotName: string): Promise<void>;
    /**
     * Restore Docker sandbox from snapshot
     */
    private restoreDockerSnapshot;
    /**
     * Destroy a sandbox
     */
    destroySandbox(sandboxId: string): Promise<void>;
    /**
     * Destroy Docker sandbox
     */
    private destroyDockerSandbox;
    /**
     * Destroy E2B sandbox
     */
    private destroyE2BSandbox;
    /**
     * Destroy Modal sandbox
     */
    private destroyModalSandbox;
    /**
     * Process pending queue when capacity becomes available
     */
    private processQueue;
    /**
     * Get sandbox status
     */
    getSandbox(sandboxId: string): Sandbox | undefined;
    /**
     * Get all active sandboxes
     */
    getActiveSandboxes(): Sandbox[];
    /**
     * Clean up all sandboxes (emergency shutdown)
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=sandbox.d.ts.map