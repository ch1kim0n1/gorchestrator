// Run a task using the Docker sandbox backend.
// Each attempt runs in an isolated node:20-alpine container with network isolation.
//
// Requirements:
//   - Docker daemon running and accessible (docker ps should work)
//   - node:20-alpine image pulled (or Docker will pull it automatically)
//   - GOrchestrator server running with SANDBOX_BACKEND=docker
//
// Setup:
//   npm install && npm run build (in gorchestrator/)
//   SANDBOX_BACKEND=docker npm run serve
//
// Env vars:
//   SANDBOX_BACKEND=docker        (required for this example)
//   ANTHROPIC_API_KEY             (required)
//   GORCHESTRATOR_URL             (default: http://localhost:8080)
//
// Usage: node examples/run-with-docker.js

const baseUrl = process.env.GORCHESTRATOR_URL ?? 'http://localhost:8080';

async function main() {
  console.log(`Targeting GOrchestrator at ${baseUrl}`);
  console.log('Note: This example requires Docker daemon to be running.\n');

  const res = await fetch(`${baseUrl}/gorchestrator/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'Write and run a Node.js script that prints "hello from docker"',
      sandbox_backend: 'docker',
      config: {
        model: 'claude-haiku-4-5',
        max_attempts: 1,
        timeout_ms: 60000,
        resource_limits: {
          cpu_cores: 1,
          memory_mb: 512,
          disk_gb: 2,
          max_wall_time_ms: 30000,
        },
        network_isolation: true,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`GOrchestrator returned ${res.status}:`, body);
    console.log('\nTroubleshooting:');
    console.log('  1. Verify Docker is running:    docker ps');
    console.log('  2. Start gorchestrator server:  SANDBOX_BACKEND=docker npm run serve');
    console.log('  3. Check Docker image exists:   docker pull node:20-alpine');
    process.exit(1);
  }

  const result = await res.json();
  console.log('Docker run result:', JSON.stringify(result, null, 2));
  console.log('\nDocker-sandboxed run completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
