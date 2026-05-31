import { GOrchestratorMCPServer } from './mcp/server.js';
import { SecureHealthServer, type HealthCheckResult, type ReadinessCheckResult } from './core/public-health-server.js';
import { coreLogger } from './core/observability.js';

// Honor GORCHESTRATOR_PORT as an alias for HEALTH_PORT (used by docker-compose),
// then HEALTH_PORT, defaulting to 8080.
const HEALTH_PORT = (() => {
  const raw = process.env.HEALTH_PORT ?? process.env.GORCHESTRATOR_PORT;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8080;
})();

async function main() {
  const server = new GOrchestratorMCPServer();

  // Create health server
  const healthServer = new SecureHealthServer(
    async (): Promise<HealthCheckResult> => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }),
    async (): Promise<ReadinessCheckResult> => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      dependencies: {},
    }),
    HEALTH_PORT
  );

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    coreLogger.info('Received shutdown signal', { signal });
    await healthServer.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  healthServer.addShutdownHandler(async () => {
    coreLogger.info('Cleanup complete');
  });

  try {
    await healthServer.start();
    await server.start();
  } catch (error) {
    coreLogger.error('Failed to start GOrchestrator', error instanceof Error ? error : { error: String(error) });
    process.exit(1);
  }
}

main().catch((error) => coreLogger.error('Main function error', error instanceof Error ? error : { error: String(error) }));
