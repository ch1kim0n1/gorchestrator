import { OrchestratorRunRecord } from '../types/index.js';
/**
 * Main GOrchestrator
 *
 * Ties together all components:
 * - Intake & Priming
 * - Configuration Sampling
 * - Parallel Execution
 * - Scoring via GMirror
 * - Selection
 * - Persistence to GBrain
 */
export declare class GOrchestrator {
    private intakePrimer;
    private configSampler;
    private sandboxManager;
    private selectorEngine;
    private gbrainEndpoint;
    private gmirrorEndpoint;
    private gtomEndpoint;
    private gstackEndpoint;
    constructor(config?: {
        gbrainEndpoint?: string;
        gmirrorEndpoint?: string;
        gtomEndpoint?: string;
        gstackEndpoint?: string;
        maxConcurrency?: number;
        sandboxBackend?: 'docker' | 'e2b' | 'modal' | 'daytona' | 'firecracker';
    });
    /**
     * Main entry point: run a task through the full orchestration pipeline
     */
    runTask(rawTask: {
        description: string;
        taskType?: string;
        surfaces?: string[];
        constraints?: any[];
        outcomeShape?: any;
        budget?: any;
        userContext?: string;
        companyContext?: string;
        n?: number;
        verify?: boolean;
        cognitiveCheck?: boolean;
    }): Promise<OrchestratorRunRecord>;
    /**
     * Run attempts in parallel
     */
    private runParallelAttempts;
    /**
     * Score attempts via GMirror
     */
    private scoreAttempts;
    /**
     * Fallback scoring when GMirror is unavailable
     */
    private fallbackScore;
    /**
     * Perform cognitive check via GToM
     */
    private performCognitiveCheck;
    /**
     * Aggregate costs from all attempts
     */
    private aggregateCosts;
    /**
     * Persist run record to GBrain
     */
    private persistRunRecord;
    /**
     * Health check for all dependencies
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        components: {
            gbrain: 'ok' | 'error';
            gmirror: 'ok' | 'error';
            gtom: 'ok' | 'error';
            sandbox: 'ok' | 'error';
        };
    }>;
    /**
     * Check if an endpoint is reachable
     */
    private checkEndpoint;
    /**
     * Check sandbox backend
     */
    private checkSandbox;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=orchestrator.d.ts.map