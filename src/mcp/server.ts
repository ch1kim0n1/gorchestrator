import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { GOrchestrator } from '../core/orchestrator.js';
import { coreLogger, LocalAuditLogger } from '../core/observability.js';
import { getDefaultSecretManager, PermissionModel } from '../core/security.js';
import { createAuthMiddleware, type AuthConfig, type AuthToken } from '@gstack/shared/core';

type McpScope = 'read' | 'write';

interface IssuedToken {
  scopes: McpScope[];
  expiresAt: number;
}

interface RateWindow {
  minuteCount: number;
  minuteStart: number;
  hourCount: number;
  hourStart: number;
}

/**
 * MCP Server for GOrchestrator
 * 
 * Exposes GOrchestrator functionality as MCP tools for Claude Code and other agents
 */
class GOrchestratorMCPServer {
  private server: Server;
  private orchestrator: GOrchestrator;
  private authMiddleware: ReturnType<typeof createAuthMiddleware>;
  private issuedTokens = new Map<string, IssuedToken>();
  private rateWindows = new Map<string, RateWindow>();
  private requireAuth: boolean;
  private allowAnonymousRead: boolean;
  private defaultScopes: McpScope[];
  private rateLimitRpm: number;
  private rateLimitRph: number;
  private bootstrapToken?: string;
  private bootstrapScopes: McpScope[];
  private permissions: PermissionModel;
  private securityAudit: LocalAuditLogger;

  constructor(authConfig?: AuthConfig) {
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

    const env = typeof process !== 'undefined' ? process.env : {};
    const secrets = getDefaultSecretManager();
    this.requireAuth = env.GORCHESTRATOR_REQUIRE_AUTH === 'true';
    this.allowAnonymousRead = env.GORCHESTRATOR_ALLOW_ANONYMOUS_READ !== 'false';
    this.defaultScopes = this.parseScopes(env.GORCHESTRATOR_MCP_DEFAULT_SCOPES || 'read,write');
    this.bootstrapToken = secrets.get('gorchestrator_mcp_token');
    this.bootstrapScopes = this.parseScopes(env.GORCHESTRATOR_MCP_TOKEN_SCOPES || 'read,write');
    this.permissions = PermissionModel.loadDefault();
    this.securityAudit = new LocalAuditLogger('gorchestrator');

    this.authMiddleware = createAuthMiddleware(authConfig || {
      secret: secrets.get('gorchestrator_auth_secret') || 'dev-secret-key',
      tool: 'gorchestrator',
      defaultRoles: this.defaultScopes,
    });

    this.rateLimitRpm = this.parseLimit(env.GORCHESTRATOR_RATE_LIMIT_RPM, 60);
    this.rateLimitRph = this.parseLimit(env.GORCHESTRATOR_RATE_LIMIT_RPH, 1000);

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
          {
            name: 'gorch_get_receipts',
            description: 'Get execution receipts from the receipt registry',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of receipts to return',
                },
                offset: {
                  type: 'number',
                  description: 'Offset for pagination',
                },
                startDate: {
                  type: 'string',
                  description: 'Start date for filtering (ISO 8601)',
                },
                endDate: {
                  type: 'string',
                  description: 'End date for filtering (ISO 8601)',
                },
              },
            },
          },
          {
            name: 'gorch_get_drift',
            description: 'Get drift statistics for metrics',
            inputSchema: {
              type: 'object',
              properties: {
                metricName: {
                  type: 'string',
                  description: 'Specific metric name to check (optional)',
                },
              },
            },
          },
          {
            name: 'gorch_get_cost_stats',
            description: 'Get cost statistics from the cost ledger',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'gorch_sandbox_stats',
            description: 'Get sandbox pool statistics',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'gorch_get_sandbox_stats',
            description: 'Get sandbox pool statistics',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'gorch_attempts',
            description: 'Get attempt statistics',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of attempts to return',
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls with token auth, read/write scopes, and per-token rate limits.
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;
      const requiredScope = this.requiredScopeForTool(name);
      const auth = this.authorize(request.params._meta, requiredScope);
      if (!auth.ok) {
        this.securityAudit.logSecurityEvent({
          event: 'mcp_auth_denied',
          target: name,
          scope: requiredScope,
          success: false,
          error: auth.error,
        });
        return this.errorResponse(auth.error);
      }

      const rateLimit = this.checkRateLimit(auth.token);
      if (!rateLimit.allowed) {
        this.securityAudit.logSecurityEvent({
          event: 'mcp_rate_limited',
          actor: this.tokenLabel(auth.token),
          target: name,
          scope: requiredScope,
          success: false,
          metadata: { reset_at: rateLimit.resetAt },
        });
        return this.errorResponse(`Rate limit exceeded. Reset at ${rateLimit.resetAt}`);
      }

      try {
        switch (name) {
          case 'gorch_run':
            return await this.handleRun(args as any);
          case 'gorch_health':
            return await this.handleHealth();
          case 'gorch_config_sample':
            return await this.handleConfigSample(args as any);
          case 'gorch_get_receipts':
            return await this.handleGetReceipts(args as any);
          case 'gorch_get_drift':
            return await this.handleGetDrift(args as any);
          case 'gorch_get_cost_stats':
            return await this.handleGetCostStats();
          case 'gorch_sandbox_stats':
          case 'gorch_get_sandbox_stats':
            return await this.handleSandboxStats();
          case 'gorch_attempts':
            return await this.handleAttempts(args as any);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return this.errorResponse(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  generateToken(customRoles?: string[]): AuthToken {
    const token = this.authMiddleware.getAuth().generateToken(customRoles);
    this.issuedTokens.set(token.token, {
      scopes: this.parseScopes(token.roles.join(',')),
      expiresAt: new Date(token.expiresAt).getTime(),
    });
    this.securityAudit.logSecurityEvent({
      event: 'mcp_token_issued',
      actor: this.tokenLabel(token.token),
      scope: token.roles.join(','),
      success: true,
      metadata: { expires_at: token.expiresAt },
    });
    return token;
  }

  private authorize(meta: Record<string, unknown> | undefined, requiredScope: McpScope) {
    const authHeaderRaw = meta?.authorization;
    const authHeader = typeof authHeaderRaw === 'string' ? authHeaderRaw : '';

    if (!authHeader) {
      if (!this.requireAuth && requiredScope === 'read' && this.allowAnonymousRead) {
        return { ok: true as const, token: 'anonymous-read' };
      }
      return { ok: false as const, error: `Authentication failed: missing bearer token for ${requiredScope} scope` };
    }

    const auth = this.authMiddleware.authenticate(authHeader);
    if (!auth.success) {
      return { ok: false as const, error: `Authentication failed: ${auth.error}` };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const scopes = this.scopesForToken(token, auth.token?.roles || []);
    if (!scopes.includes(requiredScope)) {
      return { ok: false as const, error: `Insufficient permissions: requires ${requiredScope} scope` };
    }

    return { ok: true as const, token };
  }

  private scopesForToken(token: string, fallbackRoles: string[]): McpScope[] {
    const issued = this.issuedTokens.get(token);
    if (issued && issued.expiresAt >= Date.now()) {
      return issued.scopes;
    }
    if (this.bootstrapToken && token === this.bootstrapToken) {
      return this.bootstrapScopes;
    }
    if (this.bootstrapToken) {
      return [];
    }
    const fallback = this.parseScopes(fallbackRoles.join(','));
    return this.permissions.scopesForToken(token, fallback).filter((scope): scope is McpScope => scope === 'read' || scope === 'write');
  }

  private requiredScopeForTool(name: string): McpScope {
    const writeTools = new Set(['gorch_run', 'gorch_config_sample']);
    return writeTools.has(name) ? 'write' : 'read';
  }

  private checkRateLimit(token: string) {
    const now = Date.now();
    const minuteMs = 60 * 1000;
    const hourMs = 60 * 60 * 1000;
    let window = this.rateWindows.get(token);
    if (!window) {
      window = { minuteCount: 0, minuteStart: now, hourCount: 0, hourStart: now };
      this.rateWindows.set(token, window);
    }
    if (now - window.minuteStart >= minuteMs) {
      window.minuteStart = now;
      window.minuteCount = 0;
    }
    if (now - window.hourStart >= hourMs) {
      window.hourStart = now;
      window.hourCount = 0;
    }
    if (window.minuteCount >= this.rateLimitRpm || window.hourCount >= this.rateLimitRph) {
      const resetAt = new Date(Math.min(window.minuteStart + minuteMs, window.hourStart + hourMs)).toISOString();
      return { allowed: false, resetAt };
    }
    window.minuteCount++;
    window.hourCount++;
    return { allowed: true, resetAt: new Date(window.minuteStart + minuteMs).toISOString() };
  }

  private parseScopes(value: string): McpScope[] {
    const scopes = value
      .split(',')
      .map(scope => scope.trim())
      .filter((scope): scope is McpScope => scope === 'read' || scope === 'write');
    return scopes.length > 0 ? scopes : ['read'];
  }

  private parseLimit(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private tokenLabel(token: string): string {
    return token === 'anonymous-read' ? token : `token:${this.authMiddleware.getAuth().hashToken(token)}`;
  }

  private errorResponse(text: string) {
    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
      isError: true,
    };
  }

  private static readonly RunArgsSchema = z.object({
    task: z.string().min(1),
    n: z.number().int().positive().optional(),
    taskType: z.string().optional(),
    verify: z.boolean().optional(),
    cognitiveCheck: z.boolean().optional(),
  });

  private async handleRun(args: {
    task: string;
    n?: number;
    taskType?: string;
    verify?: boolean;
    cognitiveCheck?: boolean;
  }) {
    const parsed = GOrchestratorMCPServer.RunArgsSchema.safeParse(args);
    if (!parsed.success) {
      return this.errorResponse(`Invalid request: ${JSON.stringify(parsed.error.flatten())}`);
    }
    const result = await this.orchestrator.runTask({
      description: parsed.data.task,
      taskType: parsed.data.taskType,
      n: parsed.data.n || 5,
      verify: parsed.data.verify !== false,
      cognitiveCheck: parsed.data.cognitiveCheck || false,
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

  private async handleGetReceipts(args: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const receipts = await this.orchestrator.getReceipts(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(receipts, null, 2),
        },
      ],
    };
  }

  private async handleGetDrift(args: {
    metricName?: string;
  } = {}) {
    const drift = await this.orchestrator.getDrift(args.metricName);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(drift, null, 2),
        },
      ],
    };
  }

  private async handleGetCostStats() {
    const stats = this.orchestrator.getCostStats();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  private async handleSandboxStats() {
    const stats = this.orchestrator.getSandboxStats();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  private async handleAttempts(args: {
    limit?: number;
  } = {}) {
    const attempts = this.orchestrator.getAttempts(args.limit);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(attempts, null, 2),
        },
      ],
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    coreLogger.info('GOrchestrator MCP Server started');
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new GOrchestratorMCPServer();
  server.start().catch((error) => coreLogger.error('GOrchestrator MCP Server failed', {
    error: error instanceof Error ? error.message : String(error),
  }));
}

export { GOrchestratorMCPServer };
