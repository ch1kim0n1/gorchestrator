// Run a task using the in-process sandbox backend — no Docker required.
// SANDBOX_BACKEND=inprocess routes execution through the InProcessSandboxBackend,
// which calls an LLM directly instead of spinning up a container.
//
// Setup: npm install && npm run build (in gorchestrator/)
// Env vars:
//   SANDBOX_BACKEND=inprocess   (required — disables Docker)
//   ANTHROPIC_API_KEY           (required — LLM key for in-process execution)
//   GORCHESTRATOR_URL           (default: http://localhost:8080)
//
// Usage: SANDBOX_BACKEND=inprocess node examples/run-inprocess.js

process.env.SANDBOX_BACKEND = process.env.SANDBOX_BACKEND ?? 'inprocess';

const baseUrl = process.env.GORCHESTRATOR_URL ?? 'http://localhost:8080';

async function main() {
  console.log(`Using SANDBOX_BACKEND=${process.env.SANDBOX_BACKEND}`);
  console.log(`Targeting GOrchestrator at ${baseUrl}`);

  // POST a conflict prediction request — the lightest-weight operation
  // that demonstrates the orchestrator is running with in-process sandbox.
  const res = await fetch(`${baseUrl}/gorchestrator/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'Write a one-line Node.js hello-world script',
      sandbox_backend: 'inprocess',
      config: {
        model: 'claude-haiku-4-5',
        max_attempts: 1,
        timeout_ms: 30000,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`GOrchestrator returned ${res.status}:`, body);
    console.log('\nNote: Start the gorchestrator server first with:');
    console.log('  SANDBOX_BACKEND=inprocess npm run serve');
    process.exit(1);
  }

  const result = await res.json();
  console.log('\nRun result:', JSON.stringify(result, null, 2));
  console.log('\nIn-process run completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
