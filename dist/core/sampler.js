"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationSampler = void 0;
const uuid_1 = require("uuid");
/**
 * Configuration Sampler
 *
 * Responsibilities:
 * - Determine N (number of attempts) based on priors and budget
 * - Sample N distinct agent configurations
 * - Blend exploit/perturb/explore strategies
 * - Ensure configuration diversity
 */
class ConfigurationSampler {
    gstackEndpoint;
    defaultModels;
    defaultSkills;
    constructor(config = {}) {
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
    }
    /**
     * Main entry point: generate N configurations for a task
     */
    async sampleConfigurations(taskBundle, n) {
        const totalConfigs = n || taskBundle.budget.max_attempts;
        // Query GStack for available skills
        const availableSkills = await this.queryAvailableSkills(taskBundle);
        // Determine strategy distribution based on priors
        const strategyDistribution = this.determineStrategyDistribution(taskBundle);
        // Generate configurations
        const configs = [];
        for (let i = 0; i < totalConfigs; i++) {
            const strategy = this.selectStrategy(strategyDistribution, i, totalConfigs);
            const config = await this.generateConfiguration(strategy, taskBundle, availableSkills, i);
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
    determineStrategyDistribution(taskBundle) {
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
    selectStrategy(distribution, index, total) {
        const strategies = ['exploit', 'perturb', 'explore'];
        const weights = strategies.map(s => distribution[s]);
        // Use index-based selection for deterministic results
        const cumulativeWeights = [];
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
    async generateConfiguration(strategy, taskBundle, availableSkills, index) {
        const configId = (0, uuid_1.v4)();
        let baseModel;
        let reasoningBudget;
        let skillSet;
        let decompositionStrategy;
        let toolScopes;
        let reasoningStyle;
        let sampling;
        let parentConfigId;
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
                const perturbation = this.generatePerturbation(index);
                baseModel = baseConfig?.base_model || this.defaultModels[0];
                reasoningBudget = this.perturbValue(baseConfig?.reasoning_budget || 100000, perturbation, 0.2);
                skillSet = this.perturbSkillSet(baseConfig?.skill_set || this.selectRelevantSkills(availableSkills, taskBundle), perturbation);
                decompositionStrategy = this.perturbStrategy(baseConfig?.decomposition_strategy || 'hierarchical', perturbation);
                toolScopes = this.perturbToolScopes(baseConfig?.tool_scopes || this.defaultToolScopes(), perturbation);
                reasoningStyle = this.perturbReasoningStyle(baseConfig?.reasoning_style || 'depth_first', perturbation);
                sampling = this.perturbSampling(baseConfig?.sampling || this.defaultSampling(), perturbation);
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
    selectWinnerConfig(taskBundle, index) {
        const winners = taskBundle.priors.winning_configs;
        if (winners.length === 0)
            return undefined;
        // Round-robin through winners, weighted by win rate
        const sortedWinners = [...winners].sort((a, b) => b.win_rate - a.win_rate);
        return sortedWinners[index % sortedWinners.length].config;
    }
    /**
     * Select relevant skills for the task
     */
    selectRelevantSkills(availableSkills, taskBundle) {
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
    isSkillRelevant(skill, taskType, surfaces) {
        const skillLower = skill.name.toLowerCase();
        const taskLower = taskType.toLowerCase();
        if (skillLower.includes(taskLower))
            return true;
        if (surfaces.some(s => skillLower.includes(s.toLowerCase())))
            return true;
        return false;
    }
    /**
     * Default tool scopes for most tasks
     */
    defaultToolScopes() {
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
    defaultSampling() {
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
    generatePerturbation(index) {
        // Deterministic pseudo-random perturbation
        return ((index * 9301 + 49297) % 233280) / 233280; // [0, 1]
    }
    /**
     * Perturb a numeric value
     */
    perturbValue(base, perturbation, variance) {
        const delta = (perturbation - 0.5) * 2 * variance; // [-variance, variance]
        return Math.max(0, Math.round(base * (1 + delta)));
    }
    /**
     * Perturb skill set by adding/removing skills
     */
    perturbSkillSet(baseSkills, perturbation) {
        const newSkills = [...baseSkills];
        const action = perturbation < 0.33 ? 'add' : perturbation < 0.66 ? 'remove' : 'swap';
        if (action === 'add' && newSkills.length < 8) {
            const addSkill = this.defaultSkills[Math.floor(perturbation * 100) % this.defaultSkills.length];
            if (!newSkills.includes(addSkill)) {
                newSkills.push(addSkill);
            }
        }
        else if (action === 'remove' && newSkills.length > 2) {
            newSkills.splice(Math.floor(perturbation * newSkills.length), 1);
        }
        else if (action === 'swap') {
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
    perturbStrategy(baseStrategy, perturbation) {
        const strategies = ['hierarchical', 'flat', 'iterative', 'plan_then_execute'];
        const currentIndex = strategies.indexOf(baseStrategy);
        const newIndex = (currentIndex + Math.floor((perturbation - 0.5) * 2) + strategies.length) % strategies.length;
        return strategies[newIndex];
    }
    /**
     * Perturb tool scopes
     */
    perturbToolScopes(baseScopes, perturbation) {
        return baseScopes.map(scope => {
            if (perturbation > 0.7 && scope.access_level === 'read') {
                return { ...scope, access_level: 'write' };
            }
            if (perturbation < 0.3 && scope.access_level === 'write') {
                return { ...scope, access_level: 'read' };
            }
            return scope;
        });
    }
    /**
     * Perturb reasoning style
     */
    perturbReasoningStyle(baseStyle, perturbation) {
        const styles = ['depth_first', 'breadth_first', 'plan_then_act', 'react_style', 'hybrid'];
        const currentIndex = styles.indexOf(baseStyle);
        const newIndex = (currentIndex + Math.floor((perturbation - 0.5) * 2) + styles.length) % styles.length;
        return styles[newIndex];
    }
    /**
     * Perturb sampling parameters
     */
    perturbSampling(baseSampling, perturbation) {
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
    exploreValue(min, max, index) {
        const normalizedIndex = (index * 7919) % 10000 / 10000;
        return Math.round(min + normalizedIndex * (max - min));
    }
    /**
     * Explore skill set combinations
     */
    exploreSkillSet(availableSkills, taskBundle, index) {
        const relevantSkills = this.selectRelevantSkills(availableSkills, taskBundle);
        const allSkills = [...new Set([...relevantSkills, ...this.defaultSkills])];
        // Select 3-7 skills based on index
        const count = 3 + (index % 5);
        const selected = [];
        for (let i = 0; i < count && i < allSkills.length; i++) {
            const skillIndex = (index + i * 7) % allSkills.length;
            selected.push(allSkills[skillIndex]);
        }
        return selected;
    }
    /**
     * Explore decomposition strategy
     */
    exploreStrategy(index) {
        const strategies = ['hierarchical', 'flat', 'iterative', 'plan_then_execute'];
        return strategies[index % strategies.length];
    }
    /**
     * Explore tool scopes
     */
    exploreToolScopes(index) {
        const base = this.defaultToolScopes();
        const variations = [
            base,
            base.map(s => ({ ...s, access_level: 'write' })),
            base.map(s => ({ ...s, access_level: 'read' })),
            base.filter(s => s.tool_name !== 'database'),
        ];
        return variations[index % variations.length];
    }
    /**
     * Explore reasoning style
     */
    exploreReasoningStyle(index) {
        const styles = ['depth_first', 'breadth_first', 'plan_then_act', 'react_style', 'hybrid'];
        return styles[index % styles.length];
    }
    /**
     * Explore sampling parameters
     */
    exploreSampling(index) {
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
    ensureDiversity(configs) {
        // Check for duplicate configurations
        const seen = new Set();
        const duplicates = [];
        for (let i = 0; i < configs.length; i++) {
            const signature = this.configSignature(configs[i]);
            if (seen.has(signature)) {
                duplicates.push(i);
            }
            else {
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
    configSignature(config) {
        return `${config.base_model}:${config.reasoning_style}:${config.skill_set.join(',')}`;
    }
    /**
     * Perturb a configuration to ensure diversity
     */
    perturbConfig(config, index) {
        return {
            ...config,
            config_id: (0, uuid_1.v4)(),
            sampling: {
                ...config.sampling,
                temperature: Math.max(0, Math.min(2, config.sampling.temperature + 0.1)),
            },
            reasoning_budget: config.reasoning_budget + 10000,
        };
    }
    /**
     * Query GStack for available skills
     */
    async queryAvailableSkills(taskBundle) {
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
        }
        catch (error) {
            console.warn(`[ConfigurationSampler] GStack query failed: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }
}
exports.ConfigurationSampler = ConfigurationSampler;
//# sourceMappingURL=sampler.js.map