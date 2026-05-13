import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GOrchestrator } from '../core/orchestrator.js';

/**
 * MCP Server for GOrchestrator
 * 
 * Exposes GOrchestrator functionality as MCP tools for Claude Code and other agents
 */
class GOrchestratorMCPServer {
  private server: Server;
  private orchestrator: GOrchestrator;

  constructor() {
    this.server = new Server(
      {
        name: 'gorchestrator',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.orchestrator = new GOrchestrator();

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'gorch_run',
            description: 'Run a task through parallel orchestration with N attempts, scoring, and selection',
            inputSchema: {
              type: 'object',
              properties: {
                task: {
                  type: 'string',
                  description: 'Task description to execute',
                },
                n: {
                  type: 'number',
                  description: 'Number of parallel attempts (default: 5)',
                  default: 5,
                },
                taskType: {
                  type: 'string',
                  description: 'Task type (code_generation, refactor, deployment, research, document_write)',
                },
                verify: {
                  type: 'boolean',
                  description: 'Enable GMirror verification (default: true)',
                  default: true,
                },
                cognitiveCheck: {
                  type: 'boolean',
                  description: 'Enable GToM cognitive check (default: false)',
                  default: false,
                },
              },
              required: ['task'],
            },
          },
          {
            name: 'gorch_health',
            description: 'Check health of GOrchestrator and its dependencies',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'gorch_config_sample',
            description: 'Sample agent configurations for a task without running',
            inputSchema: {
              type: 'object',
              properties: {
                task: {
                  type: 'string',
                  description: 'Task description',
                },
                taskType: {
                  type: 'string',
                  description: 'Task type',
                },
                n: {
                  type: 'number',
                  description: 'Number of configurations to sample',
                  default: 5,
                },
              },
              required: ['task'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'gorch_run':
            return await this.handleRun(args as any);
          case 'gorch_health':
            return await this.handleHealth();
          case 'gorch_config_sample':
            return await this.handleConfigSample(args as any);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleRun(args: {
    task: string;
    n?: number;
    taskType?: string;
    verify?: boolean;
    cognitiveCheck?: boolean;
  }) {
    const result = await this.orchestrator.runTask({
      description: args.task,
      taskType: args.taskType,
      n: args.n || 5,
      verify: args.verify !== false,
      cognitiveCheck: args.cognitiveCheck || false,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            task_id: result.task_id,
            winner: result.winner,
            attempts: result.attempts.length,
            total_cost: result.total_cost.total_cost_usd,
            total_wall_time_ms: result.total_wall_time_ms,
            gbrain_write_status: result.gbrain_write_status,
            attempt_summary: result.attempts.map(a => ({
              attempt_id: a.attempt_id,
              status: a.status,
              score: a.scores?.overall_score,
              selected: a.selected,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async handleHealth() {
    const health = await this.orchestrator.healthCheck();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(health, null, 2),
        },
      ],
    };
  }

  private async handleConfigSample(args: {
    task: string;
    taskType?: string;
    n?: number;
  }) {
    // For MVP, return a simple response
    // In production, would call ConfigurationSampler directly
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            task: args.task,
            taskType: args.taskType,
            n: args.n || 5,
            configs: [
              {
                config_id: 'sample-1',
                base_model: 'claude-3-5-sonnet',
                reasoning_style: 'depth_first',
                provenance: 'sample',
              },
              {
                config_id: 'sample-2',
                base_model: 'gpt-4o',
                reasoning_style: 'plan_then_act',
                provenance: 'sample',
              },
            ],
          }, null, 2),
        },
      ],
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[GOrchestrator MCP Server] Started');
  }
}

// Start server if run directly
// @ts-ignore - CommonJS compatibility
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new GOrchestratorMCPServer();
  server.start().catch(console.error);
}

export { GOrchestratorMCPServer };
