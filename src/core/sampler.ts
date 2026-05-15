import { v4 as uuidv4 } from 'uuid';
import {
  TaskBundle,
  AgentConfig,
  SamplingPlan,
  SamplingStrategy,
  SamplingParams,
  ReasoningStyle,
  ToolScope,
  ConfigProvenance,
  GStackSkillManifest,
  GBrainPriorBundle,
} from '../types/index.js';
import { LLMClient } from './llm-client.js';
import { coreLogger } from './observability.js';

/**
 * Configuration Sampler
 * 
 * Responsibilities:
 * - Determine N (number of attempts) based on priors and budget
 * - Sample N distinct agent configurations
 * - Blend exploit/perturb/explore strategies
 * - Ensure configuration diversity
 */
export class ConfigurationSampler {
  private gstackEndpoint: string;
  private defaultModels: string[];
  private defaultSkills: string[];
  private llmClient: LLMClient;

  constructor(config: {
    gstackEndpoint?: string;
    defaultModels?: string[];
    defaultSkills?: string[];
    llmClient?: LLMClient;
  } = {}) {
    this.gstackEndpoint = config.gstackEndpoint || 'http://localhost:3001';
    this.defaultModels = config.defaultModels || [
      'claude-3-5-sonnet-20241022',
      'gpt-4o-2024-08-06',
      'gemini-1.5-pro-002',
    ];
    this.defaultSkills = config.defaultSkills || [
      'code_review',
      'security_scan',
      'test_generation',
      'deployment',
    ];
    this.llmClient = config.llmClient ?? new LLMClient();
  }

  /**
   * Main entry point: generate N configurations for a task
   */
  async sampleConfigurations(
    taskBundle: TaskBundle,
    n?: number
  ): Promise<SamplingPlan> {
    const totalConfigs = n || taskBundle.budget.max_attempts;
    
    // Query GStack for available skills
    const availableSkills = await this.queryAvailableSkills(taskBundle);
    
    // Determine strategy distribution based on priors
    const strategyDistribution = this.determineStrategyDistribution(taskBundle);
    
    // Generate configurations
    const configs: AgentConfig[] = [];
    
    for (let i = 0; i < totalConfigs; i++) {
      const strategy = this.selectStrategy(strategyDistribution, i, totalConfigs);
      const config = await this.generateConfiguration(
        strategy,
        taskBundle,
        availableSkills,
        i
      );
      configs.push(config);
    }

    // Validate diversity
    this.ensureDiversity(configs);

    return {
      configs,
      strategy_distribution: strategyDistribution,
      total_configs: totalConfigs,
      metadata: {
        task_id: taskBundle.task_id,
        task_type: taskBundle.signature.task_type,
        priors_count: taskBundle.priors.winning_configs.length,
      },
    };
  }

  /**
   * Determine exploit/perturb/explore distribution
   */
  private determineStrategyDistribution(taskBundle: TaskBundle): Record<SamplingStrategy, number> {
    const priorsCount = taskBundle.priors.winning_configs.length;
    const recommendedN = taskBundle.priors.recommended_n;
    
    // If we have strong priors, exploit more
    // If we have weak priors, explore more
    const exploitWeight = Math.min(0.6, 0.3 + (priorsCount / recommendedN) * 0.3);
    const perturbWeight = 0.2;
    const exploreWeight = 1 - exploitWeight - perturbWeight;
    
    // Ensure minimum exploration
    const adjustedExplore = Math.max(0.2, exploreWeight);
    const adjustedExploit = exploitWeight - (adjustedExplore - exploreWeight);
    
    return {
      exploit: adjustedExploit,
      perturb: perturbWeight,
      explore: adjustedExplore,
      manual: 0,
    };
  }

  /**
   * Select strategy for a specific configuration index
   */
  private selectStrategy(
    distribution: Record<SamplingStrategy, number>,
    index: number,
    total: number
  ): SamplingStrategy {
    const strategies: SamplingStrategy[] = ['exploit', 'perturb', 'explore'];
    const weights = strategies.map(s => distribution[s]);
    
    // Use index-based selection for deterministic results
    const cumulativeWeights: number[] = [];
    let sum = 0;
    for (const w of weights) {
      sum += w;
      cumulativeWeights.push(sum);
    }
    
    const normalizedIndex = (index / total) * sum;
    for (let i = 0; i < cumulativeWeights.length; i++) {
      if (normalizedIndex <= cumulativeWeights[i]) {
        return strategies[i];
      }
    }
    
    return strategies[strategies.length - 1];
  }

  /**
   * Generate a single configuration based on strategy
   */
  private async generateConfiguration(
    strategy: SamplingStrategy,
    taskBundle: TaskBundle,
    availableSkills: GStackSkillManifest[],
    index: number
  ): Promise<AgentConfig> {
    const configId = uuidv4();
    
    let baseModel: string;
    let reasoningBudget: number;
    let skillSet: string[];
    let decompositionStrategy: string;
    let toolScopes: ToolScope[];
    let reasoningStyle: ReasoningStyle;
    let sampling: SamplingParams;
    let parentConfigId: string | undefined;

    switch (strategy) {
      case 'exploit':
        // Use winning configurations from priors
        const winnerConfig = this.selectWinnerConfig(taskBundle, index);
        baseModel = winnerConfig?.base_model || this.defaultModels[0];
        reasoningBudget = winnerConfig?.reasoning_budget || 100000;
        skillSet = winnerConfig?.skill_set || this.selectRelevantSkills(availableSkills, taskBundle);
        decompositionStrategy = winnerConfig?.decomposition_strategy || 'hierarchical';
        toolScopes = winnerConfig?.tool_scopes || this.defaultToolScopes();
        reasoningStyle = winnerConfig?.reasoning_style || 'depth_first';
        sampling = winnerConfig?.sampling || this.defaultSampling();
        parentConfigId = winnerConfig?.config_id;
        break;

      case 'perturb':
        // Take a winner and vary parameters
        const baseConfig = this.selectWinnerConfig(taskBundle, index);
        const mechanicalPerturbation = this.generateMechanicalPerturbation(baseConfig, availableSkills, taskBundle, index);
        const llmPerturbation = await this.generateLLMPerturbation(
          baseConfig,
          mechanicalPerturbation,
          taskBundle,
          availableSkills
        );
        baseModel = llmPerturbation.base_model;
        reasoningBudget = llmPerturbation.reasoning_budget;
        skillSet = llmPerturbation.skill_set;
        decompositionStrategy = llmPerturbation.decomposition_strategy;
        toolScopes = llmPerturbation.tool_scopes;
        reasoningStyle = llmPerturbation.reasoning_style;
        sampling = llmPerturbation.sampling;
        parentConfigId = baseConfig?.config_id;
        break;

      case 'explore':
        // Generate novel configurations
        baseModel = this.defaultModels[index % this.defaultModels.length];
        reasoningBudget = this.exploreValue(50000, 200000, index);
        skillSet = this.exploreSkillSet(availableSkills, taskBundle, index);
        decompositionStrategy = this.exploreStrategy(index);
        toolScopes = this.exploreToolScopes(index);
        reasoningStyle = this.exploreReasoningStyle(index);
        sampling = this.exploreSampling(index);
        parentConfigId = undefined;
        break;

      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }

    return {
      config_id: configId,
      base_model: baseModel,
      reasoning_budget: reasoningBudget,
      skill_set: skillSet,
      decomposition_strategy: decompositionStrategy,
      tool_scopes: toolScopes,
      reasoning_style: reasoningStyle,
      sampling: sampling,
      provenance: strategy,
      parent_config_id: parentConfigId,
      metadata: {
        generation_index: index,
        task_type: taskBundle.signature.task_type,
      },
    };
  }

  /**
   * Select a winning configuration from priors
   */
  private selectWinnerConfig(taskBundle: TaskBundle, index: number): AgentConfig | undefined {
    const winners = taskBundle.priors.winning_configs;
    if (winners.length === 0) return undefined;
    
    // Round-robin through winners, weighted by win rate
    const sortedWinners = [...winners].sort((a, b) => b.win_rate - a.win_rate);
    return sortedWinners[index % sortedWinners.length].config;
  }

  /**
   * Select relevant skills for the task
   */
  private selectRelevantSkills(availableSkills: GStackSkillManifest[], taskBundle: TaskBundle): string[] {
    const taskType = taskBundle.signature.task_type;
    const surfaces = taskBundle.signature.surfaces;
    
    const relevantSkills = availableSkills
      .filter(skill => this.isSkillRelevant(skill, taskType, surfaces))
      .slice(0, 6)
      .map(skill => skill.skill_id);
    
    return relevantSkills.length > 0 ? relevantSkills : this.defaultSkills;
  }

  /**
   * Check if a skill is relevant to the task
   */
  private isSkillRelevant(skill: GStackSkillManifest, taskType: string, surfaces: string[]): boolean {
    const skillLower = skill.name.toLowerCase();
    const taskLower = taskType.toLowerCase();
    
    if (skillLower.includes(taskLower)) return true;
    if (surfaces.some(s => skillLower.includes(s.toLowerCase()))) return true;
    
    return false;
  }

  /**
   * Default tool scopes for most tasks
   */
  private defaultToolScopes(): ToolScope[] {
    return [
      { tool_name: 'filesystem', access_level: 'write' },
      { tool_name: 'terminal', access_level: 'read' },
      { tool_name: 'web', access_level: 'read' },
      { tool_name: 'database', access_level: 'none' },
    ];
  }

  /**
   * Default sampling parameters
   */
  private defaultSampling(): SamplingParams {
    return {
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0,
      presence_penalty: 0,
    };
  }

  /**
   * Generate perturbation value based on index
   */
  private generatePerturbation(index: number): number {
    // Deterministic pseudo-random perturbation
    return ((index * 9301 + 49297) % 233280) / 233280; // [0, 1]
  }

  private generateMechanicalPerturbation(
    baseConfig: AgentConfig | undefined,
    availableSkills: GStackSkillManifest[],
    taskBundle: TaskBundle,
    index: number
  ): Omit<AgentConfig, 'config_id' | 'provenance' | 'parent_config_id' | 'metadata'> {
    const perturbation = this.generatePerturbation(index);
    const baseSkills = baseConfig?.skill_set || this.selectRelevantSkills(availableSkills, taskBundle);

    return {
      base_model: baseConfig?.base_model || this.defaultModels[0],
      reasoning_budget: this.perturbValue(baseConfig?.reasoning_budget || 100000, perturbation, 0.2),
      skill_set: this.perturbSkillSet(baseSkills, perturbation),
      decomposition_strategy: this.perturbStrategy(baseConfig?.decomposition_strategy || 'hierarchical', perturbation),
      tool_scopes: this.perturbToolScopes(baseConfig?.tool_scopes || this.defaultToolScopes(), perturbation),
      reasoning_style: this.perturbReasoningStyle(baseConfig?.reasoning_style || 'depth_first', perturbation),
      sampling: this.perturbSampling(baseConfig?.sampling || this.defaultSampling(), perturbation),
    };
  }

  private async generateLLMPerturbation(
    baseConfig: AgentConfig | undefined,
    fallbackConfig: Omit<AgentConfig, 'config_id' | 'provenance' | 'parent_config_id' | 'metadata'>,
    taskBundle: TaskBundle,
    availableSkills: GStackSkillManifest[]
  ): Promise<Omit<AgentConfig, 'config_id' | 'provenance' | 'parent_config_id' | 'metadata'>> {
    const prompt = `Create an intentionally perturbed agent configuration for this task.

Task: ${taskBundle.raw_description}
Task type: ${taskBundle.signature.task_type}
Surfaces: ${taskBundle.signature.surfaces.join(', ')}
Base winning config: ${JSON.stringify(baseConfig || fallbackConfig)}
Available skills: ${availableSkills.map(skill => skill.skill_id).join(', ') || this.defaultSkills.join(', ')}

Return strict JSON with keys:
{
  "base_model": "model id",
  "reasoning_budget": 100000,
  "skill_set": ["skill id"],
  "decomposition_strategy": "strategy",
  "tool_scopes": [{"tool_name":"filesystem","access_level":"write"}],
  "reasoning_style": "depth_first" | "breadth_first" | "plan_then_act" | "react_style" | "hybrid",
  "sampling": {"temperature":0.7,"top_p":0.9,"frequency_penalty":0,"presence_penalty":0}
}`;

    try {
      const model = this.llmClient.getModelByTier('tier1');
      const result = await this.llmClient.call(prompt, { model, temperature: 0.4 });
      const parsed = JSON.parse(result.content);
      return this.normalizeLLMConfig(parsed, fallbackConfig);
    } catch (error) {
      return fallbackConfig;
    }
  }

  private normalizeLLMConfig(
    parsed: Record<string, any>,
    fallback: Omit<AgentConfig, 'config_id' | 'provenance' | 'parent_config_id' | 'metadata'>
  ): Omit<AgentConfig, 'config_id' | 'provenance' | 'parent_config_id' | 'metadata'> {
    const validStyles: ReasoningStyle[] = ['depth_first', 'breadth_first', 'plan_then_act', 'react_style', 'hybrid'];
    const toolScopes = Array.isArray(parsed.tool_scopes)
      ? parsed.tool_scopes
          .filter((scope: any) => typeof scope?.tool_name === 'string')
          .map((scope: any) => ({
            tool_name: String(scope.tool_name),
            access_level: ['none', 'read', 'write', 'admin'].includes(scope.access_level)
              ? scope.access_level
              : 'read',
            constraints: Array.isArray(scope.constraints) ? scope.constraints.map(String) : undefined,
          }))
      : fallback.tool_scopes;

    return {
      base_model: typeof parsed.base_model === 'string' ? parsed.base_model : fallback.base_model,
      reasoning_budget: typeof parsed.reasoning_budget === 'number' && parsed.reasoning_budget > 0
        ? Math.round(parsed.reasoning_budget)
        : fallback.reasoning_budget,
      skill_set: Array.isArray(parsed.skill_set) && parsed.skill_set.length > 0
        ? parsed.skill_set.map(String)
        : fallback.skill_set,
      decomposition_strategy: typeof parsed.decomposition_strategy === 'string'
        ? parsed.decomposition_strategy
        : fallback.decomposition_strategy,
      tool_scopes: toolScopes.length > 0 ? toolScopes : fallback.tool_scopes,
      reasoning_style: validStyles.includes(parsed.reasoning_style) ? parsed.reasoning_style : fallback.reasoning_style,
      sampling: {
        temperature: this.clampNumber(parsed.sampling?.temperature, fallback.sampling.temperature, 0, 2),
        top_p: this.clampNumber(parsed.sampling?.top_p, fallback.sampling.top_p, 0.1, 1),
        frequency_penalty: this.clampNumber(parsed.sampling?.frequency_penalty, fallback.sampling.frequency_penalty, -2, 2),
        presence_penalty: this.clampNumber(parsed.sampling?.presence_penalty, fallback.sampling.presence_penalty, -2, 2),
      },
    };
  }

  private clampNumber(value: unknown, fallback: number, min: number, max: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback;
  }

  /**
   * Perturb a numeric value
   */
  private perturbValue(base: number, perturbation: number, variance: number): number {
    const delta = (perturbation - 0.5) * 2 * variance; // [-variance, variance]
    return Math.max(0, Math.round(base * (1 + delta)));
  }

  /**
   * Perturb skill set by adding/removing skills
   */
  private perturbSkillSet(baseSkills: string[], perturbation: number): string[] {
    const newSkills = [...baseSkills];
    const action = perturbation < 0.33 ? 'add' : perturbation < 0.66 ? 'remove' : 'swap';
    
    if (action === 'add' && newSkills.length < 8) {
      const addSkill = this.defaultSkills[Math.floor(perturbation * 100) % this.defaultSkills.length];
      if (!newSkills.includes(addSkill)) {
        newSkills.push(addSkill);
      }
    } else if (action === 'remove' && newSkills.length > 2) {
      newSkills.splice(Math.floor(perturbation * newSkills.length), 1);
    } else if (action === 'swap') {
      const swapSkill = this.defaultSkills[Math.floor(perturbation * 100) % this.defaultSkills.length];
      if (newSkills.length > 0) {
        newSkills[Math.floor(perturbation * newSkills.length)] = swapSkill;
      }
    }
    
    return newSkills;
  }

  /**
   * Perturb decomposition strategy
   */
  private perturbStrategy(baseStrategy: string, perturbation: number): string {
    const strategies = ['hierarchical', 'flat', 'iterative', 'plan_then_execute'];
    const currentIndex = strategies.indexOf(baseStrategy);
    const newIndex = (currentIndex + Math.floor((perturbation - 0.5) * 2) + strategies.length) % strategies.length;
    return strategies[newIndex];
  }

  /**
   * Perturb tool scopes
   */
  private perturbToolScopes(baseScopes: ToolScope[], perturbation: number): ToolScope[] {
    return baseScopes.map(scope => {
      if (perturbation > 0.7 && scope.access_level === 'read') {
        return { ...scope, access_level: 'write' as const };
      }
      if (perturbation < 0.3 && scope.access_level === 'write') {
        return { ...scope, access_level: 'read' as const };
      }
      return scope;
    });
  }

  /**
   * Perturb reasoning style
   */
  private perturbReasoningStyle(baseStyle: ReasoningStyle, perturbation: number): ReasoningStyle {
    const styles: ReasoningStyle[] = ['depth_first', 'breadth_first', 'plan_then_act', 'react_style', 'hybrid'];
    const currentIndex = styles.indexOf(baseStyle);
    const newIndex = (currentIndex + Math.floor((perturbation - 0.5) * 2) + styles.length) % styles.length;
    return styles[newIndex];
  }

  /**
   * Perturb sampling parameters
   */
  private perturbSampling(baseSampling: SamplingParams, perturbation: number): SamplingParams {
    return {
      temperature: Math.max(0, Math.min(2, baseSampling.temperature + (perturbation - 0.5) * 0.4)),
      top_p: Math.max(0.1, Math.min(1, baseSampling.top_p + (perturbation - 0.5) * 0.2)),
      frequency_penalty: Math.max(-2, Math.min(2, baseSampling.frequency_penalty + (perturbation - 0.5) * 0.5)),
      presence_penalty: Math.max(-2, Math.min(2, baseSampling.presence_penalty + (perturbation - 0.5) * 0.5)),
    };
  }

  /**
   * Explore a value within a range
   */
  private exploreValue(min: number, max: number, index: number): number {
    const normalizedIndex = (index * 7919) % 10000 / 10000;
    return Math.round(min + normalizedIndex * (max - min));
  }

  /**
   * Explore skill set combinations
   */
  private exploreSkillSet(availableSkills: GStackSkillManifest[], taskBundle: TaskBundle, index: number): string[] {
    const relevantSkills = this.selectRelevantSkills(availableSkills, taskBundle);
    const allSkills = [...new Set([...relevantSkills, ...this.defaultSkills])];
    
    // Select 3-7 skills based on index
    const count = 3 + (index % 5);
    const selected: string[] = [];
    
    for (let i = 0; i < count && i < allSkills.length; i++) {
      const skillIndex = (index + i * 7) % allSkills.length;
      selected.push(allSkills[skillIndex]);
    }
    
    return selected;
  }

  /**
   * Explore decomposition strategy
   */
  private exploreStrategy(index: number): string {
    const strategies = ['hierarchical', 'flat', 'iterative', 'plan_then_execute'];
    return strategies[index % strategies.length];
  }

  /**
   * Explore tool scopes
   */
  private exploreToolScopes(index: number): ToolScope[] {
    const base = this.defaultToolScopes();
    const variations = [
      base,
      base.map(s => ({ ...s, access_level: 'write' as const })),
      base.map(s => ({ ...s, access_level: 'read' as const })),
      base.filter(s => s.tool_name !== 'database'),
    ];
    return variations[index % variations.length];
  }

  /**
   * Explore reasoning style
   */
  private exploreReasoningStyle(index: number): ReasoningStyle {
    const styles: ReasoningStyle[] = ['depth_first', 'breadth_first', 'plan_then_act', 'react_style', 'hybrid'];
    return styles[index % styles.length];
  }

  /**
   * Explore sampling parameters
   */
  private exploreSampling(index: number): SamplingParams {
    const base = this.defaultSampling();
    return {
      temperature: 0.3 + (index % 7) * 0.25,
      top_p: 0.7 + (index % 5) * 0.075,
      frequency_penalty: (index % 5) - 2,
      presence_penalty: ((index + 2) % 5) - 2,
    };
  }

  /**
   * Ensure configuration diversity
   */
  private ensureDiversity(configs: AgentConfig[]): void {
    // Check for duplicate configurations
    const seen = new Set<string>();
    const duplicates: number[] = [];
    
    for (let i = 0; i < configs.length; i++) {
      const signature = this.configSignature(configs[i]);
      if (seen.has(signature)) {
        duplicates.push(i);
      } else {
        seen.add(signature);
      }
    }
    
    // Perturb duplicates to ensure diversity
    for (const index of duplicates) {
      configs[index] = this.perturbConfig(configs[index], index);
    }
  }

  /**
   * Generate signature for configuration deduplication
   */
  private configSignature(config: AgentConfig): string {
    return `${config.base_model}:${config.reasoning_style}:${config.skill_set.join(',')}`;
  }

  /**
   * Perturb a configuration to ensure diversity
   */
  private perturbConfig(config: AgentConfig, index: number): AgentConfig {
    return {
      ...config,
      config_id: uuidv4(),
      sampling: {
        ...config.sampling,
        temperature: Math.max(0, Math.min(2, config.sampling.temperature + 0.1)),
      },
      reasoning_budget: config.reasoning_budget + 10000,
    };
  }

  /**
   * Synchronously create a sampling plan from priors (no GStack query)
   */
  createSamplingPlan(
    taskBundle: TaskBundle,
    priors: GBrainPriorBundle,
    n: number
  ): SamplingPlan {
    if (n <= 0) {
      throw new Error(`createSamplingPlan: n must be a positive integer, got ${n}`);
    }
    const configs: AgentConfig[] = [];
    const strategies: SamplingStrategy[] = ['exploit', 'perturb', 'explore'];

    for (let i = 0; i < n; i++) {
      const strategy: SamplingStrategy = priors.winning_configs.length > 0 && i === 0
        ? 'exploit'
        : strategies[i % strategies.length];

      const winnerCfg = strategy === 'exploit' ? priors.winning_configs[0]?.config : undefined;

      configs.push({
        config_id: uuidv4(),
        base_model: winnerCfg?.base_model ?? this.defaultModels[i % this.defaultModels.length],
        reasoning_budget: winnerCfg?.reasoning_budget ?? 100000,
        skill_set: winnerCfg?.skill_set ?? this.defaultSkills.slice(0, 2),
        decomposition_strategy: winnerCfg?.decomposition_strategy ?? 'hierarchical',
        tool_scopes: winnerCfg?.tool_scopes ?? [],
        reasoning_style: winnerCfg?.reasoning_style ?? 'depth_first',
        sampling: winnerCfg?.sampling ?? { temperature: 0.7, top_p: 0.9, frequency_penalty: 0, presence_penalty: 0 },
        provenance: strategy,
        parent_config_id: winnerCfg?.config_id,
      });
    }

    const strategyCounts = configs.reduce((acc, c) => {
      acc[c.provenance] = (acc[c.provenance] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const strategyDistribution: Record<string, number> = {};
    for (const [k, v] of Object.entries(strategyCounts)) {
      strategyDistribution[k] = v / configs.length;
    }

    return {
      configs,
      strategy_distribution: strategyDistribution,
      total_configs: n,
    };
  }

  /**
   * Query GStack for available skills
   */
  private async queryAvailableSkills(taskBundle: TaskBundle): Promise<GStackSkillManifest[]> {
    try {
      const response = await fetch(`${this.gstackEndpoint}/gstack/skills`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.available_skills || [];
    } catch (error) {
      coreLogger.warn('GStack query failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
