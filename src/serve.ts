import { GOrchestratorMCPServer } from './mcp/server.js';
import { SecureHealthServer, type HealthCheckResult, type ReadinessCheckResult } from './core/public-health-server.js';
import { coreLogger } from './core/observability.js';

const HEALTH_PORT = process.env.HEALTH_PORT ? parseInt(process.env.HEALTH_PORT, 10) : 8080;

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
