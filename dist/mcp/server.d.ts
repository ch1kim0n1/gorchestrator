/**
 * MCP Server for GOrchestrator
 *
 * Exposes GOrchestrator functionality as MCP tools for Claude Code and other agents
 */
declare class GOrchestratorMCPServer {
    private server;
    private orchestrator;
    constructor();
    private setupHandlers;
    private handleRun;
    private handleHealth;
    private handleConfigSample;
    start(): Promise<void>;
}
export { GOrchestratorMCPServer };
//# sourceMappingURL=server.d.ts.map