import { GOrchestratorMCPServer } from './mcp/server.js';
import { HealthServer, type HealthCheckResult, type ReadinessCheckResult } from '../../shared/src/core/health-server.js';

const HEALTH_PORT = process.env.HEALTH_PORT ? parseInt(process.env.HEALTH_PORT, 10) : 8080;

async function main() {
  const server = new GOrchestratorMCPServer();

  // Create health server
  const healthServer = new HealthServer(
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
    console.log(`Received ${signal}, shutting down gracefully...`);
    await healthServer.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  healthServer.addShutdownHandler(async () => {
    console.log('[GOrchestrator] Cleanup complete');
  });

  try {
    await healthServer.start();
    await server.start();
  } catch (error) {
    console.error('Failed to start GOrchestrator:', error);
    process.exit(1);
  }
}

main().catch(console.error);
