import { TaskBundle, SamplingPlan } from '../types/index.js';
/**
 * Configuration Sampler
 *
 * Responsibilities:
 * - Determine N (number of attempts) based on priors and budget
 * - Sample N distinct agent configurations
 * - Blend exploit/perturb/explore strategies
 * - Ensure configuration diversity
 */
export declare class ConfigurationSampler {
    private gstackEndpoint;
    private defaultModels;
    private defaultSkills;
    constructor(config?: {
        gstackEndpoint?: string;
        defaultModels?: string[];
        defaultSkills?: string[];
    });
    /**
     * Main entry point: generate N configurations for a task
     */
    sampleConfigurations(taskBundle: TaskBundle, n?: number): Promise<SamplingPlan>;
    /**
     * Determine exploit/perturb/explore distribution
     */
    private determineStrategyDistribution;
    /**
     * Select strategy for a specific configuration index
     */
    private selectStrategy;
    /**
     * Generate a single configuration based on strategy
     */
    private generateConfiguration;
    /**
     * Select a winning configuration from priors
     */
    private selectWinnerConfig;
    /**
     * Select relevant skills for the task
     */
    private selectRelevantSkills;
    /**
     * Check if a skill is relevant to the task
     */
    private isSkillRelevant;
    /**
     * Default tool scopes for most tasks
     */
    private defaultToolScopes;
    /**
     * Default sampling parameters
     */
    private defaultSampling;
    /**
     * Generate perturbation value based on index
     */
    private generatePerturbation;
    /**
     * Perturb a numeric value
     */
    private perturbValue;
    /**
     * Perturb skill set by adding/removing skills
     */
    private perturbSkillSet;
    /**
     * Perturb decomposition strategy
     */
    private perturbStrategy;
    /**
     * Perturb tool scopes
     */
    private perturbToolScopes;
    /**
     * Perturb reasoning style
     */
    private perturbReasoningStyle;
    /**
     * Perturb sampling parameters
     */
    private perturbSampling;
    /**
     * Explore a value within a range
     */
    private exploreValue;
    /**
     * Explore skill set combinations
     */
    private exploreSkillSet;
    /**
     * Explore decomposition strategy
     */
    private exploreStrategy;
    /**
     * Explore tool scopes
     */
    private exploreToolScopes;
    /**
     * Explore reasoning style
     */
    private exploreReasoningStyle;
    /**
     * Explore sampling parameters
     */
    private exploreSampling;
    /**
     * Ensure configuration diversity
     */
    private ensureDiversity;
    /**
     * Generate signature for configuration deduplication
     */
    private configSignature;
    /**
     * Perturb a configuration to ensure diversity
     */
    private perturbConfig;
    /**
     * Query GStack for available skills
     */
    private queryAvailableSkills;
}
//# sourceMappingURL=sampler.d.ts.map