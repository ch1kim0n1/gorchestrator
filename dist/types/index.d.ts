import { z } from 'zod';
export declare const ConstraintSchema: z.ZodObject<{
    type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
    value: z.ZodString;
    operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
    priority: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "latency" | "cost" | "security" | "compliance" | "performance";
    value: string;
    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
    priority: number;
}, {
    type: "latency" | "cost" | "security" | "compliance" | "performance";
    value: string;
    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
    priority: number;
}>;
export type Constraint = z.infer<typeof ConstraintSchema>;
export declare const OutcomeShapeSchema: z.ZodObject<{
    type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
    format: z.ZodString;
    validation_criteria: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    type: "code" | "document" | "deployment" | "research" | "config_change";
    format: string;
    validation_criteria: string[];
}, {
    type: "code" | "document" | "deployment" | "research" | "config_change";
    format: string;
    validation_criteria: string[];
}>;
export type OutcomeShape = z.infer<typeof OutcomeShapeSchema>;
export declare const GBrainRefSchema: z.ZodObject<{
    ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
    ref_id: z.ZodString;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    ref_type: "page" | "entity" | "skill" | "pattern";
    ref_id: string;
    confidence: number;
}, {
    ref_type: "page" | "entity" | "skill" | "pattern";
    ref_id: string;
    confidence: number;
}>;
export type GBrainRef = z.infer<typeof GBrainRefSchema>;
export declare const TaskSignatureSchema: z.ZodObject<{
    task_type: z.ZodString;
    surfaces: z.ZodArray<z.ZodString, "many">;
    constraints: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
        value: z.ZodString;
        operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
        priority: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "latency" | "cost" | "security" | "compliance" | "performance";
        value: string;
        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
        priority: number;
    }, {
        type: "latency" | "cost" | "security" | "compliance" | "performance";
        value: string;
        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
        priority: number;
    }>, "many">;
    outcome_shape: z.ZodObject<{
        type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
        format: z.ZodString;
        validation_criteria: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        format: string;
        validation_criteria: string[];
    }, {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        format: string;
        validation_criteria: string[];
    }>;
    context_refs: z.ZodArray<z.ZodObject<{
        ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
        ref_id: z.ZodString;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        ref_type: "page" | "entity" | "skill" | "pattern";
        ref_id: string;
        confidence: number;
    }, {
        ref_type: "page" | "entity" | "skill" | "pattern";
        ref_id: string;
        confidence: number;
    }>, "many">;
    hash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    task_type: string;
    surfaces: string[];
    constraints: {
        type: "latency" | "cost" | "security" | "compliance" | "performance";
        value: string;
        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
        priority: number;
    }[];
    outcome_shape: {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        format: string;
        validation_criteria: string[];
    };
    context_refs: {
        ref_type: "page" | "entity" | "skill" | "pattern";
        ref_id: string;
        confidence: number;
    }[];
    hash: string;
}, {
    task_type: string;
    surfaces: string[];
    constraints: {
        type: "latency" | "cost" | "security" | "compliance" | "performance";
        value: string;
        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
        priority: number;
    }[];
    outcome_shape: {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        format: string;
        validation_criteria: string[];
    };
    context_refs: {
        ref_type: "page" | "entity" | "skill" | "pattern";
        ref_id: string;
        confidence: number;
    }[];
    hash: string;
}>;
export type TaskSignature = z.infer<typeof TaskSignatureSchema>;
export declare const GBrainPriorBundleSchema: z.ZodObject<{
    similar_tasks: z.ZodArray<z.ZodObject<{
        task_type: z.ZodString;
        surfaces: z.ZodArray<z.ZodString, "many">;
        constraints: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
            value: z.ZodString;
            operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
            priority: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }, {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }>, "many">;
        outcome_shape: z.ZodObject<{
            type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
            format: z.ZodString;
            validation_criteria: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        }, {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        }>;
        context_refs: z.ZodArray<z.ZodObject<{
            ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
            ref_id: z.ZodString;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }, {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }>, "many">;
        hash: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        task_type: string;
        surfaces: string[];
        constraints: {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }[];
        outcome_shape: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        };
        context_refs: {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }[];
        hash: string;
    }, {
        task_type: string;
        surfaces: string[];
        constraints: {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }[];
        outcome_shape: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        };
        context_refs: {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }[];
        hash: string;
    }>, "many">;
    winning_configs: z.ZodArray<z.ZodObject<{
        config: z.ZodAny;
        win_rate: z.ZodNumber;
        n: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        win_rate: number;
        n: number;
        config?: any;
    }, {
        win_rate: number;
        n: number;
        config?: any;
    }>, "many">;
    known_failure_modes: z.ZodArray<z.ZodObject<{
        pattern: z.ZodString;
        frequency: z.ZodNumber;
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        pattern: string;
        frequency: number;
        severity: "low" | "medium" | "high" | "critical";
    }, {
        pattern: string;
        frequency: number;
        severity: "low" | "medium" | "high" | "critical";
    }>, "many">;
    recommended_n: z.ZodNumber;
    user_preferences: z.ZodRecord<z.ZodString, z.ZodAny>;
    domain_constraints: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    similar_tasks: {
        task_type: string;
        surfaces: string[];
        constraints: {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }[];
        outcome_shape: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        };
        context_refs: {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }[];
        hash: string;
    }[];
    winning_configs: {
        win_rate: number;
        n: number;
        config?: any;
    }[];
    known_failure_modes: {
        pattern: string;
        frequency: number;
        severity: "low" | "medium" | "high" | "critical";
    }[];
    recommended_n: number;
    user_preferences: Record<string, any>;
    domain_constraints: Record<string, any>;
}, {
    similar_tasks: {
        task_type: string;
        surfaces: string[];
        constraints: {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }[];
        outcome_shape: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        };
        context_refs: {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }[];
        hash: string;
    }[];
    winning_configs: {
        win_rate: number;
        n: number;
        config?: any;
    }[];
    known_failure_modes: {
        pattern: string;
        frequency: number;
        severity: "low" | "medium" | "high" | "critical";
    }[];
    recommended_n: number;
    user_preferences: Record<string, any>;
    domain_constraints: Record<string, any>;
}>;
export type GBrainPriorBundle = z.infer<typeof GBrainPriorBundleSchema>;
export declare const ExecutionBudgetSchema: z.ZodObject<{
    max_attempts: z.ZodDefault<z.ZodNumber>;
    max_cost_usd: z.ZodDefault<z.ZodNumber>;
    max_wall_time_ms: z.ZodDefault<z.ZodNumber>;
    max_parallelism: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    max_attempts: number;
    max_cost_usd: number;
    max_wall_time_ms: number;
    max_parallelism: number;
}, {
    max_attempts?: number | undefined;
    max_cost_usd?: number | undefined;
    max_wall_time_ms?: number | undefined;
    max_parallelism?: number | undefined;
}>;
export type ExecutionBudget = z.infer<typeof ExecutionBudgetSchema>;
export declare const TaskBundleSchema: z.ZodObject<{
    task_id: z.ZodString;
    raw_description: z.ZodString;
    signature: z.ZodObject<{
        task_type: z.ZodString;
        surfaces: z.ZodArray<z.ZodString, "many">;
        constraints: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
            value: z.ZodString;
            operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
            priority: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }, {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }>, "many">;
        outcome_shape: z.ZodObject<{
            type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
            format: z.ZodString;
            validation_criteria: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        }, {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        }>;
        context_refs: z.ZodArray<z.ZodObject<{
            ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
            ref_id: z.ZodString;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }, {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }>, "many">;
        hash: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        task_type: string;
        surfaces: string[];
        constraints: {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }[];
        outcome_shape: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        };
        context_refs: {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }[];
        hash: string;
    }, {
        task_type: string;
        surfaces: string[];
        constraints: {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }[];
        outcome_shape: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        };
        context_refs: {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }[];
        hash: string;
    }>;
    priors: z.ZodObject<{
        similar_tasks: z.ZodArray<z.ZodObject<{
            task_type: z.ZodString;
            surfaces: z.ZodArray<z.ZodString, "many">;
            constraints: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
                value: z.ZodString;
                operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
                priority: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }, {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }>, "many">;
            outcome_shape: z.ZodObject<{
                type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
                format: z.ZodString;
                validation_criteria: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            }, {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            }>;
            context_refs: z.ZodArray<z.ZodObject<{
                ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
                ref_id: z.ZodString;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }, {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }>, "many">;
            hash: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }, {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }>, "many">;
        winning_configs: z.ZodArray<z.ZodObject<{
            config: z.ZodAny;
            win_rate: z.ZodNumber;
            n: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            win_rate: number;
            n: number;
            config?: any;
        }, {
            win_rate: number;
            n: number;
            config?: any;
        }>, "many">;
        known_failure_modes: z.ZodArray<z.ZodObject<{
            pattern: z.ZodString;
            frequency: z.ZodNumber;
            severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        }, "strip", z.ZodTypeAny, {
            pattern: string;
            frequency: number;
            severity: "low" | "medium" | "high" | "critical";
        }, {
            pattern: string;
            frequency: number;
            severity: "low" | "medium" | "high" | "critical";
        }>, "many">;
        recommended_n: z.ZodNumber;
        user_preferences: z.ZodRecord<z.ZodString, z.ZodAny>;
        domain_constraints: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        similar_tasks: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }[];
        winning_configs: {
            win_rate: number;
            n: number;
            config?: any;
        }[];
        known_failure_modes: {
            pattern: string;
            frequency: number;
            severity: "low" | "medium" | "high" | "critical";
        }[];
        recommended_n: number;
        user_preferences: Record<string, any>;
        domain_constraints: Record<string, any>;
    }, {
        similar_tasks: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }[];
        winning_configs: {
            win_rate: number;
            n: number;
            config?: any;
        }[];
        known_failure_modes: {
            pattern: string;
            frequency: number;
            severity: "low" | "medium" | "high" | "critical";
        }[];
        recommended_n: number;
        user_preferences: Record<string, any>;
        domain_constraints: Record<string, any>;
    }>;
    budget: z.ZodObject<{
        max_attempts: z.ZodDefault<z.ZodNumber>;
        max_cost_usd: z.ZodDefault<z.ZodNumber>;
        max_wall_time_ms: z.ZodDefault<z.ZodNumber>;
        max_parallelism: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        max_attempts: number;
        max_cost_usd: number;
        max_wall_time_ms: number;
        max_parallelism: number;
    }, {
        max_attempts?: number | undefined;
        max_cost_usd?: number | undefined;
        max_wall_time_ms?: number | undefined;
        max_parallelism?: number | undefined;
    }>;
    created_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    task_id: string;
    raw_description: string;
    signature: {
        task_type: string;
        surfaces: string[];
        constraints: {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }[];
        outcome_shape: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        };
        context_refs: {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }[];
        hash: string;
    };
    priors: {
        similar_tasks: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }[];
        winning_configs: {
            win_rate: number;
            n: number;
            config?: any;
        }[];
        known_failure_modes: {
            pattern: string;
            frequency: number;
            severity: "low" | "medium" | "high" | "critical";
        }[];
        recommended_n: number;
        user_preferences: Record<string, any>;
        domain_constraints: Record<string, any>;
    };
    budget: {
        max_attempts: number;
        max_cost_usd: number;
        max_wall_time_ms: number;
        max_parallelism: number;
    };
    created_at: string;
}, {
    task_id: string;
    raw_description: string;
    signature: {
        task_type: string;
        surfaces: string[];
        constraints: {
            type: "latency" | "cost" | "security" | "compliance" | "performance";
            value: string;
            operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
            priority: number;
        }[];
        outcome_shape: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            format: string;
            validation_criteria: string[];
        };
        context_refs: {
            ref_type: "page" | "entity" | "skill" | "pattern";
            ref_id: string;
            confidence: number;
        }[];
        hash: string;
    };
    priors: {
        similar_tasks: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }[];
        winning_configs: {
            win_rate: number;
            n: number;
            config?: any;
        }[];
        known_failure_modes: {
            pattern: string;
            frequency: number;
            severity: "low" | "medium" | "high" | "critical";
        }[];
        recommended_n: number;
        user_preferences: Record<string, any>;
        domain_constraints: Record<string, any>;
    };
    budget: {
        max_attempts?: number | undefined;
        max_cost_usd?: number | undefined;
        max_wall_time_ms?: number | undefined;
        max_parallelism?: number | undefined;
    };
    created_at: string;
}>;
export type TaskBundle = z.infer<typeof TaskBundleSchema>;
export declare const ReasoningStyleSchema: z.ZodEnum<["depth_first", "breadth_first", "plan_then_act", "react_style", "hybrid"]>;
export type ReasoningStyle = z.infer<typeof ReasoningStyleSchema>;
export declare const SamplingParamsSchema: z.ZodObject<{
    temperature: z.ZodDefault<z.ZodNumber>;
    top_p: z.ZodDefault<z.ZodNumber>;
    top_k: z.ZodOptional<z.ZodNumber>;
    frequency_penalty: z.ZodDefault<z.ZodNumber>;
    presence_penalty: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    temperature: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    top_k?: number | undefined;
}, {
    temperature?: number | undefined;
    top_p?: number | undefined;
    top_k?: number | undefined;
    frequency_penalty?: number | undefined;
    presence_penalty?: number | undefined;
}>;
export type SamplingParams = z.infer<typeof SamplingParamsSchema>;
export declare const ToolScopeSchema: z.ZodObject<{
    tool_name: z.ZodString;
    access_level: z.ZodEnum<["none", "read", "write", "admin"]>;
    constraints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    tool_name: string;
    access_level: "none" | "read" | "write" | "admin";
    constraints?: string[] | undefined;
}, {
    tool_name: string;
    access_level: "none" | "read" | "write" | "admin";
    constraints?: string[] | undefined;
}>;
export type ToolScope = z.infer<typeof ToolScopeSchema>;
export declare const ConfigProvenanceSchema: z.ZodEnum<["exploit", "perturb", "explore", "manual"]>;
export type ConfigProvenance = z.infer<typeof ConfigProvenanceSchema>;
export declare const AgentConfigSchema: z.ZodObject<{
    config_id: z.ZodString;
    base_model: z.ZodString;
    reasoning_budget: z.ZodDefault<z.ZodNumber>;
    skill_set: z.ZodArray<z.ZodString, "many">;
    decomposition_strategy: z.ZodString;
    tool_scopes: z.ZodArray<z.ZodObject<{
        tool_name: z.ZodString;
        access_level: z.ZodEnum<["none", "read", "write", "admin"]>;
        constraints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        tool_name: string;
        access_level: "none" | "read" | "write" | "admin";
        constraints?: string[] | undefined;
    }, {
        tool_name: string;
        access_level: "none" | "read" | "write" | "admin";
        constraints?: string[] | undefined;
    }>, "many">;
    reasoning_style: z.ZodEnum<["depth_first", "breadth_first", "plan_then_act", "react_style", "hybrid"]>;
    sampling: z.ZodObject<{
        temperature: z.ZodDefault<z.ZodNumber>;
        top_p: z.ZodDefault<z.ZodNumber>;
        top_k: z.ZodOptional<z.ZodNumber>;
        frequency_penalty: z.ZodDefault<z.ZodNumber>;
        presence_penalty: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        temperature: number;
        top_p: number;
        frequency_penalty: number;
        presence_penalty: number;
        top_k?: number | undefined;
    }, {
        temperature?: number | undefined;
        top_p?: number | undefined;
        top_k?: number | undefined;
        frequency_penalty?: number | undefined;
        presence_penalty?: number | undefined;
    }>;
    provenance: z.ZodEnum<["exploit", "perturb", "explore", "manual"]>;
    parent_config_id: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    config_id: string;
    base_model: string;
    reasoning_budget: number;
    skill_set: string[];
    decomposition_strategy: string;
    tool_scopes: {
        tool_name: string;
        access_level: "none" | "read" | "write" | "admin";
        constraints?: string[] | undefined;
    }[];
    reasoning_style: "depth_first" | "breadth_first" | "plan_then_act" | "react_style" | "hybrid";
    sampling: {
        temperature: number;
        top_p: number;
        frequency_penalty: number;
        presence_penalty: number;
        top_k?: number | undefined;
    };
    provenance: "exploit" | "perturb" | "explore" | "manual";
    parent_config_id?: string | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    config_id: string;
    base_model: string;
    skill_set: string[];
    decomposition_strategy: string;
    tool_scopes: {
        tool_name: string;
        access_level: "none" | "read" | "write" | "admin";
        constraints?: string[] | undefined;
    }[];
    reasoning_style: "depth_first" | "breadth_first" | "plan_then_act" | "react_style" | "hybrid";
    sampling: {
        temperature?: number | undefined;
        top_p?: number | undefined;
        top_k?: number | undefined;
        frequency_penalty?: number | undefined;
        presence_penalty?: number | undefined;
    };
    provenance: "exploit" | "perturb" | "explore" | "manual";
    reasoning_budget?: number | undefined;
    parent_config_id?: string | undefined;
    metadata?: Record<string, any> | undefined;
}>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export declare const DeliverableSchema: z.ZodObject<{
    type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
    content: z.ZodString;
    artifacts: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        content: z.ZodOptional<z.ZodString>;
        hash: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        hash: string;
        content?: string | undefined;
    }, {
        path: string;
        hash: string;
        content?: string | undefined;
    }>, "many">;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    type: "code" | "document" | "deployment" | "research" | "config_change";
    content: string;
    artifacts: {
        path: string;
        hash: string;
        content?: string | undefined;
    }[];
    metadata?: Record<string, any> | undefined;
}, {
    type: "code" | "document" | "deployment" | "research" | "config_change";
    content: string;
    artifacts: {
        path: string;
        hash: string;
        content?: string | undefined;
    }[];
    metadata?: Record<string, any> | undefined;
}>;
export type Deliverable = z.infer<typeof DeliverableSchema>;
export declare const TraceEventSchema: z.ZodObject<{
    timestamp: z.ZodString;
    event_type: z.ZodEnum<["model_call", "tool_call", "file_mutation", "error", "checkpoint", "decision"]>;
    data: z.ZodRecord<z.ZodString, z.ZodAny>;
    cost_usd: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
    data: Record<string, any>;
    cost_usd?: number | undefined;
}, {
    timestamp: string;
    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
    data: Record<string, any>;
    cost_usd?: number | undefined;
}>;
export type TraceEvent = z.infer<typeof TraceEventSchema>;
export declare const TraceBundleSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        timestamp: z.ZodString;
        event_type: z.ZodEnum<["model_call", "tool_call", "file_mutation", "error", "checkpoint", "decision"]>;
        data: z.ZodRecord<z.ZodString, z.ZodAny>;
        cost_usd: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
        data: Record<string, any>;
        cost_usd?: number | undefined;
    }, {
        timestamp: string;
        event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
        data: Record<string, any>;
        cost_usd?: number | undefined;
    }>, "many">;
    total_cost_usd: z.ZodNumber;
    total_tokens: z.ZodNumber;
    total_wall_time_ms: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    events: {
        timestamp: string;
        event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
        data: Record<string, any>;
        cost_usd?: number | undefined;
    }[];
    total_cost_usd: number;
    total_tokens: number;
    total_wall_time_ms: number;
}, {
    events: {
        timestamp: string;
        event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
        data: Record<string, any>;
        cost_usd?: number | undefined;
    }[];
    total_cost_usd: number;
    total_tokens: number;
    total_wall_time_ms: number;
}>;
export type TraceBundle = z.infer<typeof TraceBundleSchema>;
export declare const CostBreakdownSchema: z.ZodObject<{
    model_cost_usd: z.ZodNumber;
    tool_cost_usd: z.ZodNumber;
    sandbox_cost_usd: z.ZodNumber;
    total_cost_usd: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total_cost_usd: number;
    model_cost_usd: number;
    tool_cost_usd: number;
    sandbox_cost_usd: number;
}, {
    total_cost_usd: number;
    model_cost_usd: number;
    tool_cost_usd: number;
    sandbox_cost_usd: number;
}>;
export type CostBreakdown = z.infer<typeof CostBreakdownSchema>;
export declare const AttemptResultSchema: z.ZodObject<{
    attempt_id: z.ZodString;
    task_id: z.ZodString;
    config_id: z.ZodString;
    sandbox_id: z.ZodString;
    status: z.ZodEnum<["completed", "timeout", "errored", "aborted"]>;
    deliverable: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
        content: z.ZodString;
        artifacts: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            hash: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            hash: string;
            content?: string | undefined;
        }, {
            path: string;
            hash: string;
            content?: string | undefined;
        }>, "many">;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    }, {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    }>>;
    trace: z.ZodObject<{
        events: z.ZodArray<z.ZodObject<{
            timestamp: z.ZodString;
            event_type: z.ZodEnum<["model_call", "tool_call", "file_mutation", "error", "checkpoint", "decision"]>;
            data: z.ZodRecord<z.ZodString, z.ZodAny>;
            cost_usd: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }, {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }>, "many">;
        total_cost_usd: z.ZodNumber;
        total_tokens: z.ZodNumber;
        total_wall_time_ms: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        events: {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }[];
        total_cost_usd: number;
        total_tokens: number;
        total_wall_time_ms: number;
    }, {
        events: {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }[];
        total_cost_usd: number;
        total_tokens: number;
        total_wall_time_ms: number;
    }>;
    cost: z.ZodObject<{
        model_cost_usd: z.ZodNumber;
        tool_cost_usd: z.ZodNumber;
        sandbox_cost_usd: z.ZodNumber;
        total_cost_usd: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    }, {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    }>;
    wall_time_ms: z.ZodNumber;
    started_at: z.ZodString;
    ended_at: z.ZodString;
    error_message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "aborted" | "completed" | "timeout" | "errored";
    cost: {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    };
    task_id: string;
    config_id: string;
    attempt_id: string;
    sandbox_id: string;
    trace: {
        events: {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }[];
        total_cost_usd: number;
        total_tokens: number;
        total_wall_time_ms: number;
    };
    wall_time_ms: number;
    started_at: string;
    ended_at: string;
    deliverable?: {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    } | undefined;
    error_message?: string | undefined;
}, {
    status: "aborted" | "completed" | "timeout" | "errored";
    cost: {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    };
    task_id: string;
    config_id: string;
    attempt_id: string;
    sandbox_id: string;
    trace: {
        events: {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }[];
        total_cost_usd: number;
        total_tokens: number;
        total_wall_time_ms: number;
    };
    wall_time_ms: number;
    started_at: string;
    ended_at: string;
    deliverable?: {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    } | undefined;
    error_message?: string | undefined;
}>;
export type AttemptResult = z.infer<typeof AttemptResultSchema>;
export declare const GMirrorScoreBundleSchema: z.ZodObject<{
    correctness: z.ZodObject<{
        score: z.ZodNumber;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        score: number;
        evidence: string[];
    }, {
        confidence: number;
        score: number;
        evidence: string[];
    }>;
    user_outcome: z.ZodObject<{
        score: z.ZodNumber;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        score: number;
        evidence: string[];
    }, {
        confidence: number;
        score: number;
        evidence: string[];
    }>;
    robustness: z.ZodObject<{
        score: z.ZodNumber;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        score: number;
        evidence: string[];
    }, {
        confidence: number;
        score: number;
        evidence: string[];
    }>;
    risk: z.ZodObject<{
        score: z.ZodNumber;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        score: number;
        evidence: string[];
    }, {
        confidence: number;
        score: number;
        evidence: string[];
    }>;
    overall_score: z.ZodNumber;
    hard_gates_passed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    correctness: {
        confidence: number;
        score: number;
        evidence: string[];
    };
    user_outcome: {
        confidence: number;
        score: number;
        evidence: string[];
    };
    robustness: {
        confidence: number;
        score: number;
        evidence: string[];
    };
    risk: {
        confidence: number;
        score: number;
        evidence: string[];
    };
    overall_score: number;
    hard_gates_passed: boolean;
}, {
    correctness: {
        confidence: number;
        score: number;
        evidence: string[];
    };
    user_outcome: {
        confidence: number;
        score: number;
        evidence: string[];
    };
    robustness: {
        confidence: number;
        score: number;
        evidence: string[];
    };
    risk: {
        confidence: number;
        score: number;
        evidence: string[];
    };
    overall_score: number;
    hard_gates_passed: boolean;
}>;
export type GMirrorScoreBundle = z.infer<typeof GMirrorScoreBundleSchema>;
export declare const ScoredAttemptSchema: z.ZodObject<{
    attempt_id: z.ZodString;
    task_id: z.ZodString;
    config_id: z.ZodString;
    sandbox_id: z.ZodString;
    status: z.ZodEnum<["completed", "timeout", "errored", "aborted"]>;
    deliverable: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
        content: z.ZodString;
        artifacts: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            hash: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            hash: string;
            content?: string | undefined;
        }, {
            path: string;
            hash: string;
            content?: string | undefined;
        }>, "many">;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    }, {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    }>>;
    trace: z.ZodObject<{
        events: z.ZodArray<z.ZodObject<{
            timestamp: z.ZodString;
            event_type: z.ZodEnum<["model_call", "tool_call", "file_mutation", "error", "checkpoint", "decision"]>;
            data: z.ZodRecord<z.ZodString, z.ZodAny>;
            cost_usd: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }, {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }>, "many">;
        total_cost_usd: z.ZodNumber;
        total_tokens: z.ZodNumber;
        total_wall_time_ms: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        events: {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }[];
        total_cost_usd: number;
        total_tokens: number;
        total_wall_time_ms: number;
    }, {
        events: {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }[];
        total_cost_usd: number;
        total_tokens: number;
        total_wall_time_ms: number;
    }>;
    cost: z.ZodObject<{
        model_cost_usd: z.ZodNumber;
        tool_cost_usd: z.ZodNumber;
        sandbox_cost_usd: z.ZodNumber;
        total_cost_usd: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    }, {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    }>;
    wall_time_ms: z.ZodNumber;
    started_at: z.ZodString;
    ended_at: z.ZodString;
    error_message: z.ZodOptional<z.ZodString>;
} & {
    scores: z.ZodObject<{
        correctness: z.ZodObject<{
            score: z.ZodNumber;
            confidence: z.ZodNumber;
            evidence: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            score: number;
            evidence: string[];
        }, {
            confidence: number;
            score: number;
            evidence: string[];
        }>;
        user_outcome: z.ZodObject<{
            score: z.ZodNumber;
            confidence: z.ZodNumber;
            evidence: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            score: number;
            evidence: string[];
        }, {
            confidence: number;
            score: number;
            evidence: string[];
        }>;
        robustness: z.ZodObject<{
            score: z.ZodNumber;
            confidence: z.ZodNumber;
            evidence: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            score: number;
            evidence: string[];
        }, {
            confidence: number;
            score: number;
            evidence: string[];
        }>;
        risk: z.ZodObject<{
            score: z.ZodNumber;
            confidence: z.ZodNumber;
            evidence: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            score: number;
            evidence: string[];
        }, {
            confidence: number;
            score: number;
            evidence: string[];
        }>;
        overall_score: z.ZodNumber;
        hard_gates_passed: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        correctness: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        user_outcome: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        robustness: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        risk: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        overall_score: number;
        hard_gates_passed: boolean;
    }, {
        correctness: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        user_outcome: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        robustness: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        risk: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        overall_score: number;
        hard_gates_passed: boolean;
    }>;
    selected: z.ZodBoolean;
    selection_reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "aborted" | "completed" | "timeout" | "errored";
    cost: {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    };
    task_id: string;
    config_id: string;
    attempt_id: string;
    sandbox_id: string;
    trace: {
        events: {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }[];
        total_cost_usd: number;
        total_tokens: number;
        total_wall_time_ms: number;
    };
    wall_time_ms: number;
    started_at: string;
    ended_at: string;
    scores: {
        correctness: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        user_outcome: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        robustness: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        risk: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        overall_score: number;
        hard_gates_passed: boolean;
    };
    selected: boolean;
    deliverable?: {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    } | undefined;
    error_message?: string | undefined;
    selection_reason?: string | undefined;
}, {
    status: "aborted" | "completed" | "timeout" | "errored";
    cost: {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    };
    task_id: string;
    config_id: string;
    attempt_id: string;
    sandbox_id: string;
    trace: {
        events: {
            timestamp: string;
            event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
            data: Record<string, any>;
            cost_usd?: number | undefined;
        }[];
        total_cost_usd: number;
        total_tokens: number;
        total_wall_time_ms: number;
    };
    wall_time_ms: number;
    started_at: string;
    ended_at: string;
    scores: {
        correctness: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        user_outcome: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        robustness: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        risk: {
            confidence: number;
            score: number;
            evidence: string[];
        };
        overall_score: number;
        hard_gates_passed: boolean;
    };
    selected: boolean;
    deliverable?: {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    } | undefined;
    error_message?: string | undefined;
    selection_reason?: string | undefined;
}>;
export type ScoredAttempt = z.infer<typeof ScoredAttemptSchema>;
export declare const OrchestratorRunRecordSchema: z.ZodObject<{
    task_id: z.ZodString;
    task_bundle: z.ZodObject<{
        task_id: z.ZodString;
        raw_description: z.ZodString;
        signature: z.ZodObject<{
            task_type: z.ZodString;
            surfaces: z.ZodArray<z.ZodString, "many">;
            constraints: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
                value: z.ZodString;
                operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
                priority: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }, {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }>, "many">;
            outcome_shape: z.ZodObject<{
                type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
                format: z.ZodString;
                validation_criteria: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            }, {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            }>;
            context_refs: z.ZodArray<z.ZodObject<{
                ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
                ref_id: z.ZodString;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }, {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }>, "many">;
            hash: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }, {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }>;
        priors: z.ZodObject<{
            similar_tasks: z.ZodArray<z.ZodObject<{
                task_type: z.ZodString;
                surfaces: z.ZodArray<z.ZodString, "many">;
                constraints: z.ZodArray<z.ZodObject<{
                    type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
                    value: z.ZodString;
                    operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
                    priority: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }, {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }>, "many">;
                outcome_shape: z.ZodObject<{
                    type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
                    format: z.ZodString;
                    validation_criteria: z.ZodArray<z.ZodString, "many">;
                }, "strip", z.ZodTypeAny, {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                }, {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                }>;
                context_refs: z.ZodArray<z.ZodObject<{
                    ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
                    ref_id: z.ZodString;
                    confidence: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }, {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }>, "many">;
                hash: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }, {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }>, "many">;
            winning_configs: z.ZodArray<z.ZodObject<{
                config: z.ZodAny;
                win_rate: z.ZodNumber;
                n: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                win_rate: number;
                n: number;
                config?: any;
            }, {
                win_rate: number;
                n: number;
                config?: any;
            }>, "many">;
            known_failure_modes: z.ZodArray<z.ZodObject<{
                pattern: z.ZodString;
                frequency: z.ZodNumber;
                severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
            }, "strip", z.ZodTypeAny, {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }, {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }>, "many">;
            recommended_n: z.ZodNumber;
            user_preferences: z.ZodRecord<z.ZodString, z.ZodAny>;
            domain_constraints: z.ZodRecord<z.ZodString, z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        }, {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        }>;
        budget: z.ZodObject<{
            max_attempts: z.ZodDefault<z.ZodNumber>;
            max_cost_usd: z.ZodDefault<z.ZodNumber>;
            max_wall_time_ms: z.ZodDefault<z.ZodNumber>;
            max_parallelism: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max_attempts: number;
            max_cost_usd: number;
            max_wall_time_ms: number;
            max_parallelism: number;
        }, {
            max_attempts?: number | undefined;
            max_cost_usd?: number | undefined;
            max_wall_time_ms?: number | undefined;
            max_parallelism?: number | undefined;
        }>;
        created_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts: number;
            max_cost_usd: number;
            max_wall_time_ms: number;
            max_parallelism: number;
        };
        created_at: string;
    }, {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts?: number | undefined;
            max_cost_usd?: number | undefined;
            max_wall_time_ms?: number | undefined;
            max_parallelism?: number | undefined;
        };
        created_at: string;
    }>;
    attempts: z.ZodArray<z.ZodObject<{
        attempt_id: z.ZodString;
        task_id: z.ZodString;
        config_id: z.ZodString;
        sandbox_id: z.ZodString;
        status: z.ZodEnum<["completed", "timeout", "errored", "aborted"]>;
        deliverable: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
            content: z.ZodString;
            artifacts: z.ZodArray<z.ZodObject<{
                path: z.ZodString;
                content: z.ZodOptional<z.ZodString>;
                hash: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                path: string;
                hash: string;
                content?: string | undefined;
            }, {
                path: string;
                hash: string;
                content?: string | undefined;
            }>, "many">;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        }, {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        }>>;
        trace: z.ZodObject<{
            events: z.ZodArray<z.ZodObject<{
                timestamp: z.ZodString;
                event_type: z.ZodEnum<["model_call", "tool_call", "file_mutation", "error", "checkpoint", "decision"]>;
                data: z.ZodRecord<z.ZodString, z.ZodAny>;
                cost_usd: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }, {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }>, "many">;
            total_cost_usd: z.ZodNumber;
            total_tokens: z.ZodNumber;
            total_wall_time_ms: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        }, {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        }>;
        cost: z.ZodObject<{
            model_cost_usd: z.ZodNumber;
            tool_cost_usd: z.ZodNumber;
            sandbox_cost_usd: z.ZodNumber;
            total_cost_usd: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        }, {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        }>;
        wall_time_ms: z.ZodNumber;
        started_at: z.ZodString;
        ended_at: z.ZodString;
        error_message: z.ZodOptional<z.ZodString>;
    } & {
        scores: z.ZodObject<{
            correctness: z.ZodObject<{
                score: z.ZodNumber;
                confidence: z.ZodNumber;
                evidence: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                score: number;
                evidence: string[];
            }, {
                confidence: number;
                score: number;
                evidence: string[];
            }>;
            user_outcome: z.ZodObject<{
                score: z.ZodNumber;
                confidence: z.ZodNumber;
                evidence: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                score: number;
                evidence: string[];
            }, {
                confidence: number;
                score: number;
                evidence: string[];
            }>;
            robustness: z.ZodObject<{
                score: z.ZodNumber;
                confidence: z.ZodNumber;
                evidence: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                score: number;
                evidence: string[];
            }, {
                confidence: number;
                score: number;
                evidence: string[];
            }>;
            risk: z.ZodObject<{
                score: z.ZodNumber;
                confidence: z.ZodNumber;
                evidence: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                score: number;
                evidence: string[];
            }, {
                confidence: number;
                score: number;
                evidence: string[];
            }>;
            overall_score: z.ZodNumber;
            hard_gates_passed: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        }, {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        }>;
        selected: z.ZodBoolean;
        selection_reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "aborted" | "completed" | "timeout" | "errored";
        cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        task_id: string;
        config_id: string;
        attempt_id: string;
        sandbox_id: string;
        trace: {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        };
        wall_time_ms: number;
        started_at: string;
        ended_at: string;
        scores: {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        };
        selected: boolean;
        deliverable?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
        error_message?: string | undefined;
        selection_reason?: string | undefined;
    }, {
        status: "aborted" | "completed" | "timeout" | "errored";
        cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        task_id: string;
        config_id: string;
        attempt_id: string;
        sandbox_id: string;
        trace: {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        };
        wall_time_ms: number;
        started_at: string;
        ended_at: string;
        scores: {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        };
        selected: boolean;
        deliverable?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
        error_message?: string | undefined;
        selection_reason?: string | undefined;
    }>, "many">;
    winner: z.ZodString;
    merged_output: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
        content: z.ZodString;
        artifacts: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            hash: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            hash: string;
            content?: string | undefined;
        }, {
            path: string;
            hash: string;
            content?: string | undefined;
        }>, "many">;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    }, {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    }>>;
    total_cost: z.ZodObject<{
        model_cost_usd: z.ZodNumber;
        tool_cost_usd: z.ZodNumber;
        sandbox_cost_usd: z.ZodNumber;
        total_cost_usd: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    }, {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    }>;
    total_wall_time_ms: z.ZodNumber;
    gbrain_write_status: z.ZodEnum<["pending", "written", "failed"]>;
    created_at: z.ZodString;
    completed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    task_id: string;
    created_at: string;
    total_wall_time_ms: number;
    task_bundle: {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts: number;
            max_cost_usd: number;
            max_wall_time_ms: number;
            max_parallelism: number;
        };
        created_at: string;
    };
    attempts: {
        status: "aborted" | "completed" | "timeout" | "errored";
        cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        task_id: string;
        config_id: string;
        attempt_id: string;
        sandbox_id: string;
        trace: {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        };
        wall_time_ms: number;
        started_at: string;
        ended_at: string;
        scores: {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        };
        selected: boolean;
        deliverable?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
        error_message?: string | undefined;
        selection_reason?: string | undefined;
    }[];
    winner: string;
    total_cost: {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    };
    gbrain_write_status: "pending" | "written" | "failed";
    completed_at: string;
    merged_output?: {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    } | undefined;
}, {
    task_id: string;
    created_at: string;
    total_wall_time_ms: number;
    task_bundle: {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts?: number | undefined;
            max_cost_usd?: number | undefined;
            max_wall_time_ms?: number | undefined;
            max_parallelism?: number | undefined;
        };
        created_at: string;
    };
    attempts: {
        status: "aborted" | "completed" | "timeout" | "errored";
        cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        task_id: string;
        config_id: string;
        attempt_id: string;
        sandbox_id: string;
        trace: {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        };
        wall_time_ms: number;
        started_at: string;
        ended_at: string;
        scores: {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        };
        selected: boolean;
        deliverable?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
        error_message?: string | undefined;
        selection_reason?: string | undefined;
    }[];
    winner: string;
    total_cost: {
        total_cost_usd: number;
        model_cost_usd: number;
        tool_cost_usd: number;
        sandbox_cost_usd: number;
    };
    gbrain_write_status: "pending" | "written" | "failed";
    completed_at: string;
    merged_output?: {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    } | undefined;
}>;
export type OrchestratorRunRecord = z.infer<typeof OrchestratorRunRecordSchema>;
export declare const SandboxConfigSchema: z.ZodObject<{
    backend: z.ZodEnum<["docker", "e2b", "modal", "daytona", "firecracker"]>;
    image: z.ZodString;
    resource_limits: z.ZodObject<{
        cpu_cores: z.ZodDefault<z.ZodNumber>;
        memory_mb: z.ZodDefault<z.ZodNumber>;
        disk_gb: z.ZodDefault<z.ZodNumber>;
        max_wall_time_ms: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        max_wall_time_ms: number;
        cpu_cores: number;
        memory_mb: number;
        disk_gb: number;
    }, {
        max_wall_time_ms?: number | undefined;
        cpu_cores?: number | undefined;
        memory_mb?: number | undefined;
        disk_gb?: number | undefined;
    }>;
    network_isolation: z.ZodDefault<z.ZodBoolean>;
    allowlisted_domains: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    snapshot_enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    backend: "docker" | "e2b" | "modal" | "daytona" | "firecracker";
    image: string;
    resource_limits: {
        max_wall_time_ms: number;
        cpu_cores: number;
        memory_mb: number;
        disk_gb: number;
    };
    network_isolation: boolean;
    allowlisted_domains: string[];
    snapshot_enabled: boolean;
}, {
    backend: "docker" | "e2b" | "modal" | "daytona" | "firecracker";
    image: string;
    resource_limits: {
        max_wall_time_ms?: number | undefined;
        cpu_cores?: number | undefined;
        memory_mb?: number | undefined;
        disk_gb?: number | undefined;
    };
    network_isolation?: boolean | undefined;
    allowlisted_domains?: string[] | undefined;
    snapshot_enabled?: boolean | undefined;
}>;
export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;
export declare const SandboxStateSchema: z.ZodEnum<["provisioning", "ready", "running", "completed", "failed", "destroyed"]>;
export type SandboxState = z.infer<typeof SandboxStateSchema>;
export declare const SandboxSchema: z.ZodObject<{
    sandbox_id: z.ZodString;
    config: z.ZodObject<{
        backend: z.ZodEnum<["docker", "e2b", "modal", "daytona", "firecracker"]>;
        image: z.ZodString;
        resource_limits: z.ZodObject<{
            cpu_cores: z.ZodDefault<z.ZodNumber>;
            memory_mb: z.ZodDefault<z.ZodNumber>;
            disk_gb: z.ZodDefault<z.ZodNumber>;
            max_wall_time_ms: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max_wall_time_ms: number;
            cpu_cores: number;
            memory_mb: number;
            disk_gb: number;
        }, {
            max_wall_time_ms?: number | undefined;
            cpu_cores?: number | undefined;
            memory_mb?: number | undefined;
            disk_gb?: number | undefined;
        }>;
        network_isolation: z.ZodDefault<z.ZodBoolean>;
        allowlisted_domains: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        snapshot_enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        backend: "docker" | "e2b" | "modal" | "daytona" | "firecracker";
        image: string;
        resource_limits: {
            max_wall_time_ms: number;
            cpu_cores: number;
            memory_mb: number;
            disk_gb: number;
        };
        network_isolation: boolean;
        allowlisted_domains: string[];
        snapshot_enabled: boolean;
    }, {
        backend: "docker" | "e2b" | "modal" | "daytona" | "firecracker";
        image: string;
        resource_limits: {
            max_wall_time_ms?: number | undefined;
            cpu_cores?: number | undefined;
            memory_mb?: number | undefined;
            disk_gb?: number | undefined;
        };
        network_isolation?: boolean | undefined;
        allowlisted_domains?: string[] | undefined;
        snapshot_enabled?: boolean | undefined;
    }>;
    state: z.ZodEnum<["provisioning", "ready", "running", "completed", "failed", "destroyed"]>;
    attempt_id: z.ZodOptional<z.ZodString>;
    created_at: z.ZodString;
    started_at: z.ZodOptional<z.ZodString>;
    completed_at: z.ZodOptional<z.ZodString>;
    error_message: z.ZodOptional<z.ZodString>;
    trace_stream_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    config: {
        backend: "docker" | "e2b" | "modal" | "daytona" | "firecracker";
        image: string;
        resource_limits: {
            max_wall_time_ms: number;
            cpu_cores: number;
            memory_mb: number;
            disk_gb: number;
        };
        network_isolation: boolean;
        allowlisted_domains: string[];
        snapshot_enabled: boolean;
    };
    created_at: string;
    sandbox_id: string;
    state: "completed" | "failed" | "provisioning" | "ready" | "running" | "destroyed";
    attempt_id?: string | undefined;
    started_at?: string | undefined;
    error_message?: string | undefined;
    completed_at?: string | undefined;
    trace_stream_url?: string | undefined;
}, {
    config: {
        backend: "docker" | "e2b" | "modal" | "daytona" | "firecracker";
        image: string;
        resource_limits: {
            max_wall_time_ms?: number | undefined;
            cpu_cores?: number | undefined;
            memory_mb?: number | undefined;
            disk_gb?: number | undefined;
        };
        network_isolation?: boolean | undefined;
        allowlisted_domains?: string[] | undefined;
        snapshot_enabled?: boolean | undefined;
    };
    created_at: string;
    sandbox_id: string;
    state: "completed" | "failed" | "provisioning" | "ready" | "running" | "destroyed";
    attempt_id?: string | undefined;
    started_at?: string | undefined;
    error_message?: string | undefined;
    completed_at?: string | undefined;
    trace_stream_url?: string | undefined;
}>;
export type Sandbox = z.infer<typeof SandboxSchema>;
export declare const SamplingStrategySchema: z.ZodEnum<["exploit", "perturb", "explore", "manual"]>;
export type SamplingStrategy = z.infer<typeof SamplingStrategySchema>;
export declare const SamplingPlanSchema: z.ZodObject<{
    configs: z.ZodArray<z.ZodObject<{
        config_id: z.ZodString;
        base_model: z.ZodString;
        reasoning_budget: z.ZodDefault<z.ZodNumber>;
        skill_set: z.ZodArray<z.ZodString, "many">;
        decomposition_strategy: z.ZodString;
        tool_scopes: z.ZodArray<z.ZodObject<{
            tool_name: z.ZodString;
            access_level: z.ZodEnum<["none", "read", "write", "admin"]>;
            constraints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            tool_name: string;
            access_level: "none" | "read" | "write" | "admin";
            constraints?: string[] | undefined;
        }, {
            tool_name: string;
            access_level: "none" | "read" | "write" | "admin";
            constraints?: string[] | undefined;
        }>, "many">;
        reasoning_style: z.ZodEnum<["depth_first", "breadth_first", "plan_then_act", "react_style", "hybrid"]>;
        sampling: z.ZodObject<{
            temperature: z.ZodDefault<z.ZodNumber>;
            top_p: z.ZodDefault<z.ZodNumber>;
            top_k: z.ZodOptional<z.ZodNumber>;
            frequency_penalty: z.ZodDefault<z.ZodNumber>;
            presence_penalty: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            temperature: number;
            top_p: number;
            frequency_penalty: number;
            presence_penalty: number;
            top_k?: number | undefined;
        }, {
            temperature?: number | undefined;
            top_p?: number | undefined;
            top_k?: number | undefined;
            frequency_penalty?: number | undefined;
            presence_penalty?: number | undefined;
        }>;
        provenance: z.ZodEnum<["exploit", "perturb", "explore", "manual"]>;
        parent_config_id: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        config_id: string;
        base_model: string;
        reasoning_budget: number;
        skill_set: string[];
        decomposition_strategy: string;
        tool_scopes: {
            tool_name: string;
            access_level: "none" | "read" | "write" | "admin";
            constraints?: string[] | undefined;
        }[];
        reasoning_style: "depth_first" | "breadth_first" | "plan_then_act" | "react_style" | "hybrid";
        sampling: {
            temperature: number;
            top_p: number;
            frequency_penalty: number;
            presence_penalty: number;
            top_k?: number | undefined;
        };
        provenance: "exploit" | "perturb" | "explore" | "manual";
        parent_config_id?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }, {
        config_id: string;
        base_model: string;
        skill_set: string[];
        decomposition_strategy: string;
        tool_scopes: {
            tool_name: string;
            access_level: "none" | "read" | "write" | "admin";
            constraints?: string[] | undefined;
        }[];
        reasoning_style: "depth_first" | "breadth_first" | "plan_then_act" | "react_style" | "hybrid";
        sampling: {
            temperature?: number | undefined;
            top_p?: number | undefined;
            top_k?: number | undefined;
            frequency_penalty?: number | undefined;
            presence_penalty?: number | undefined;
        };
        provenance: "exploit" | "perturb" | "explore" | "manual";
        reasoning_budget?: number | undefined;
        parent_config_id?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }>, "many">;
    strategy_distribution: z.ZodRecord<z.ZodString, z.ZodNumber>;
    total_configs: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    configs: {
        config_id: string;
        base_model: string;
        reasoning_budget: number;
        skill_set: string[];
        decomposition_strategy: string;
        tool_scopes: {
            tool_name: string;
            access_level: "none" | "read" | "write" | "admin";
            constraints?: string[] | undefined;
        }[];
        reasoning_style: "depth_first" | "breadth_first" | "plan_then_act" | "react_style" | "hybrid";
        sampling: {
            temperature: number;
            top_p: number;
            frequency_penalty: number;
            presence_penalty: number;
            top_k?: number | undefined;
        };
        provenance: "exploit" | "perturb" | "explore" | "manual";
        parent_config_id?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }[];
    strategy_distribution: Record<string, number>;
    total_configs: number;
    metadata?: Record<string, any> | undefined;
}, {
    configs: {
        config_id: string;
        base_model: string;
        skill_set: string[];
        decomposition_strategy: string;
        tool_scopes: {
            tool_name: string;
            access_level: "none" | "read" | "write" | "admin";
            constraints?: string[] | undefined;
        }[];
        reasoning_style: "depth_first" | "breadth_first" | "plan_then_act" | "react_style" | "hybrid";
        sampling: {
            temperature?: number | undefined;
            top_p?: number | undefined;
            top_k?: number | undefined;
            frequency_penalty?: number | undefined;
            presence_penalty?: number | undefined;
        };
        provenance: "exploit" | "perturb" | "explore" | "manual";
        reasoning_budget?: number | undefined;
        parent_config_id?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }[];
    strategy_distribution: Record<string, number>;
    total_configs: number;
    metadata?: Record<string, any> | undefined;
}>;
export type SamplingPlan = z.infer<typeof SamplingPlanSchema>;
export declare const SelectionStrategySchema: z.ZodEnum<["highest_score", "component_substitution", "synthesized_merge"]>;
export type SelectionStrategy = z.infer<typeof SelectionStrategySchema>;
export declare const SelectionResultSchema: z.ZodObject<{
    winner_attempt_id: z.ZodString;
    strategy_used: z.ZodEnum<["highest_score", "component_substitution", "synthesized_merge"]>;
    selected_deliverable: z.ZodObject<{
        type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
        content: z.ZodString;
        artifacts: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            content: z.ZodOptional<z.ZodString>;
            hash: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            hash: string;
            content?: string | undefined;
        }, {
            path: string;
            hash: string;
            content?: string | undefined;
        }>, "many">;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    }, {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    }>;
    merge_sources: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    rationale: z.ZodString;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    winner_attempt_id: string;
    strategy_used: "highest_score" | "component_substitution" | "synthesized_merge";
    selected_deliverable: {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    };
    rationale: string;
    merge_sources?: string[] | undefined;
}, {
    confidence: number;
    winner_attempt_id: string;
    strategy_used: "highest_score" | "component_substitution" | "synthesized_merge";
    selected_deliverable: {
        type: "code" | "document" | "deployment" | "research" | "config_change";
        content: string;
        artifacts: {
            path: string;
            hash: string;
            content?: string | undefined;
        }[];
        metadata?: Record<string, any> | undefined;
    };
    rationale: string;
    merge_sources?: string[] | undefined;
}>;
export type SelectionResult = z.infer<typeof SelectionResultSchema>;
export declare const GBrainPrimingRequestSchema: z.ZodObject<{
    signature_hash: z.ZodString;
    max_results: z.ZodDefault<z.ZodNumber>;
    similarity_threshold: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    signature_hash: string;
    max_results: number;
    similarity_threshold: number;
}, {
    signature_hash: string;
    max_results?: number | undefined;
    similarity_threshold?: number | undefined;
}>;
export type GBrainPrimingRequest = z.infer<typeof GBrainPrimingRequestSchema>;
export declare const GBrainWriteRequestSchema: z.ZodObject<{
    run_record: z.ZodObject<{
        task_id: z.ZodString;
        task_bundle: z.ZodObject<{
            task_id: z.ZodString;
            raw_description: z.ZodString;
            signature: z.ZodObject<{
                task_type: z.ZodString;
                surfaces: z.ZodArray<z.ZodString, "many">;
                constraints: z.ZodArray<z.ZodObject<{
                    type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
                    value: z.ZodString;
                    operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
                    priority: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }, {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }>, "many">;
                outcome_shape: z.ZodObject<{
                    type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
                    format: z.ZodString;
                    validation_criteria: z.ZodArray<z.ZodString, "many">;
                }, "strip", z.ZodTypeAny, {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                }, {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                }>;
                context_refs: z.ZodArray<z.ZodObject<{
                    ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
                    ref_id: z.ZodString;
                    confidence: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }, {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }>, "many">;
                hash: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }, {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }>;
            priors: z.ZodObject<{
                similar_tasks: z.ZodArray<z.ZodObject<{
                    task_type: z.ZodString;
                    surfaces: z.ZodArray<z.ZodString, "many">;
                    constraints: z.ZodArray<z.ZodObject<{
                        type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
                        value: z.ZodString;
                        operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
                        priority: z.ZodNumber;
                    }, "strip", z.ZodTypeAny, {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }, {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }>, "many">;
                    outcome_shape: z.ZodObject<{
                        type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
                        format: z.ZodString;
                        validation_criteria: z.ZodArray<z.ZodString, "many">;
                    }, "strip", z.ZodTypeAny, {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    }, {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    }>;
                    context_refs: z.ZodArray<z.ZodObject<{
                        ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
                        ref_id: z.ZodString;
                        confidence: z.ZodNumber;
                    }, "strip", z.ZodTypeAny, {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }, {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }>, "many">;
                    hash: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    task_type: string;
                    surfaces: string[];
                    constraints: {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }[];
                    outcome_shape: {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    };
                    context_refs: {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }[];
                    hash: string;
                }, {
                    task_type: string;
                    surfaces: string[];
                    constraints: {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }[];
                    outcome_shape: {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    };
                    context_refs: {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }[];
                    hash: string;
                }>, "many">;
                winning_configs: z.ZodArray<z.ZodObject<{
                    config: z.ZodAny;
                    win_rate: z.ZodNumber;
                    n: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    win_rate: number;
                    n: number;
                    config?: any;
                }, {
                    win_rate: number;
                    n: number;
                    config?: any;
                }>, "many">;
                known_failure_modes: z.ZodArray<z.ZodObject<{
                    pattern: z.ZodString;
                    frequency: z.ZodNumber;
                    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
                }, "strip", z.ZodTypeAny, {
                    pattern: string;
                    frequency: number;
                    severity: "low" | "medium" | "high" | "critical";
                }, {
                    pattern: string;
                    frequency: number;
                    severity: "low" | "medium" | "high" | "critical";
                }>, "many">;
                recommended_n: z.ZodNumber;
                user_preferences: z.ZodRecord<z.ZodString, z.ZodAny>;
                domain_constraints: z.ZodRecord<z.ZodString, z.ZodAny>;
            }, "strip", z.ZodTypeAny, {
                similar_tasks: {
                    task_type: string;
                    surfaces: string[];
                    constraints: {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }[];
                    outcome_shape: {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    };
                    context_refs: {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }[];
                    hash: string;
                }[];
                winning_configs: {
                    win_rate: number;
                    n: number;
                    config?: any;
                }[];
                known_failure_modes: {
                    pattern: string;
                    frequency: number;
                    severity: "low" | "medium" | "high" | "critical";
                }[];
                recommended_n: number;
                user_preferences: Record<string, any>;
                domain_constraints: Record<string, any>;
            }, {
                similar_tasks: {
                    task_type: string;
                    surfaces: string[];
                    constraints: {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }[];
                    outcome_shape: {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    };
                    context_refs: {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }[];
                    hash: string;
                }[];
                winning_configs: {
                    win_rate: number;
                    n: number;
                    config?: any;
                }[];
                known_failure_modes: {
                    pattern: string;
                    frequency: number;
                    severity: "low" | "medium" | "high" | "critical";
                }[];
                recommended_n: number;
                user_preferences: Record<string, any>;
                domain_constraints: Record<string, any>;
            }>;
            budget: z.ZodObject<{
                max_attempts: z.ZodDefault<z.ZodNumber>;
                max_cost_usd: z.ZodDefault<z.ZodNumber>;
                max_wall_time_ms: z.ZodDefault<z.ZodNumber>;
                max_parallelism: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                max_attempts: number;
                max_cost_usd: number;
                max_wall_time_ms: number;
                max_parallelism: number;
            }, {
                max_attempts?: number | undefined;
                max_cost_usd?: number | undefined;
                max_wall_time_ms?: number | undefined;
                max_parallelism?: number | undefined;
            }>;
            created_at: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            task_id: string;
            raw_description: string;
            signature: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            };
            priors: {
                similar_tasks: {
                    task_type: string;
                    surfaces: string[];
                    constraints: {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }[];
                    outcome_shape: {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    };
                    context_refs: {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }[];
                    hash: string;
                }[];
                winning_configs: {
                    win_rate: number;
                    n: number;
                    config?: any;
                }[];
                known_failure_modes: {
                    pattern: string;
                    frequency: number;
                    severity: "low" | "medium" | "high" | "critical";
                }[];
                recommended_n: number;
                user_preferences: Record<string, any>;
                domain_constraints: Record<string, any>;
            };
            budget: {
                max_attempts: number;
                max_cost_usd: number;
                max_wall_time_ms: number;
                max_parallelism: number;
            };
            created_at: string;
        }, {
            task_id: string;
            raw_description: string;
            signature: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            };
            priors: {
                similar_tasks: {
                    task_type: string;
                    surfaces: string[];
                    constraints: {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }[];
                    outcome_shape: {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    };
                    context_refs: {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }[];
                    hash: string;
                }[];
                winning_configs: {
                    win_rate: number;
                    n: number;
                    config?: any;
                }[];
                known_failure_modes: {
                    pattern: string;
                    frequency: number;
                    severity: "low" | "medium" | "high" | "critical";
                }[];
                recommended_n: number;
                user_preferences: Record<string, any>;
                domain_constraints: Record<string, any>;
            };
            budget: {
                max_attempts?: number | undefined;
                max_cost_usd?: number | undefined;
                max_wall_time_ms?: number | undefined;
                max_parallelism?: number | undefined;
            };
            created_at: string;
        }>;
        attempts: z.ZodArray<z.ZodObject<{
            attempt_id: z.ZodString;
            task_id: z.ZodString;
            config_id: z.ZodString;
            sandbox_id: z.ZodString;
            status: z.ZodEnum<["completed", "timeout", "errored", "aborted"]>;
            deliverable: z.ZodOptional<z.ZodObject<{
                type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
                content: z.ZodString;
                artifacts: z.ZodArray<z.ZodObject<{
                    path: z.ZodString;
                    content: z.ZodOptional<z.ZodString>;
                    hash: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    path: string;
                    hash: string;
                    content?: string | undefined;
                }, {
                    path: string;
                    hash: string;
                    content?: string | undefined;
                }>, "many">;
                metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            }, "strip", z.ZodTypeAny, {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                content: string;
                artifacts: {
                    path: string;
                    hash: string;
                    content?: string | undefined;
                }[];
                metadata?: Record<string, any> | undefined;
            }, {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                content: string;
                artifacts: {
                    path: string;
                    hash: string;
                    content?: string | undefined;
                }[];
                metadata?: Record<string, any> | undefined;
            }>>;
            trace: z.ZodObject<{
                events: z.ZodArray<z.ZodObject<{
                    timestamp: z.ZodString;
                    event_type: z.ZodEnum<["model_call", "tool_call", "file_mutation", "error", "checkpoint", "decision"]>;
                    data: z.ZodRecord<z.ZodString, z.ZodAny>;
                    cost_usd: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    timestamp: string;
                    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                    data: Record<string, any>;
                    cost_usd?: number | undefined;
                }, {
                    timestamp: string;
                    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                    data: Record<string, any>;
                    cost_usd?: number | undefined;
                }>, "many">;
                total_cost_usd: z.ZodNumber;
                total_tokens: z.ZodNumber;
                total_wall_time_ms: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                events: {
                    timestamp: string;
                    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                    data: Record<string, any>;
                    cost_usd?: number | undefined;
                }[];
                total_cost_usd: number;
                total_tokens: number;
                total_wall_time_ms: number;
            }, {
                events: {
                    timestamp: string;
                    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                    data: Record<string, any>;
                    cost_usd?: number | undefined;
                }[];
                total_cost_usd: number;
                total_tokens: number;
                total_wall_time_ms: number;
            }>;
            cost: z.ZodObject<{
                model_cost_usd: z.ZodNumber;
                tool_cost_usd: z.ZodNumber;
                sandbox_cost_usd: z.ZodNumber;
                total_cost_usd: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                total_cost_usd: number;
                model_cost_usd: number;
                tool_cost_usd: number;
                sandbox_cost_usd: number;
            }, {
                total_cost_usd: number;
                model_cost_usd: number;
                tool_cost_usd: number;
                sandbox_cost_usd: number;
            }>;
            wall_time_ms: z.ZodNumber;
            started_at: z.ZodString;
            ended_at: z.ZodString;
            error_message: z.ZodOptional<z.ZodString>;
        } & {
            scores: z.ZodObject<{
                correctness: z.ZodObject<{
                    score: z.ZodNumber;
                    confidence: z.ZodNumber;
                    evidence: z.ZodArray<z.ZodString, "many">;
                }, "strip", z.ZodTypeAny, {
                    confidence: number;
                    score: number;
                    evidence: string[];
                }, {
                    confidence: number;
                    score: number;
                    evidence: string[];
                }>;
                user_outcome: z.ZodObject<{
                    score: z.ZodNumber;
                    confidence: z.ZodNumber;
                    evidence: z.ZodArray<z.ZodString, "many">;
                }, "strip", z.ZodTypeAny, {
                    confidence: number;
                    score: number;
                    evidence: string[];
                }, {
                    confidence: number;
                    score: number;
                    evidence: string[];
                }>;
                robustness: z.ZodObject<{
                    score: z.ZodNumber;
                    confidence: z.ZodNumber;
                    evidence: z.ZodArray<z.ZodString, "many">;
                }, "strip", z.ZodTypeAny, {
                    confidence: number;
                    score: number;
                    evidence: string[];
                }, {
                    confidence: number;
                    score: number;
                    evidence: string[];
                }>;
                risk: z.ZodObject<{
                    score: z.ZodNumber;
                    confidence: z.ZodNumber;
                    evidence: z.ZodArray<z.ZodString, "many">;
                }, "strip", z.ZodTypeAny, {
                    confidence: number;
                    score: number;
                    evidence: string[];
                }, {
                    confidence: number;
                    score: number;
                    evidence: string[];
                }>;
                overall_score: z.ZodNumber;
                hard_gates_passed: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                correctness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                user_outcome: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                robustness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                risk: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                overall_score: number;
                hard_gates_passed: boolean;
            }, {
                correctness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                user_outcome: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                robustness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                risk: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                overall_score: number;
                hard_gates_passed: boolean;
            }>;
            selected: z.ZodBoolean;
            selection_reason: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "aborted" | "completed" | "timeout" | "errored";
            cost: {
                total_cost_usd: number;
                model_cost_usd: number;
                tool_cost_usd: number;
                sandbox_cost_usd: number;
            };
            task_id: string;
            config_id: string;
            attempt_id: string;
            sandbox_id: string;
            trace: {
                events: {
                    timestamp: string;
                    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                    data: Record<string, any>;
                    cost_usd?: number | undefined;
                }[];
                total_cost_usd: number;
                total_tokens: number;
                total_wall_time_ms: number;
            };
            wall_time_ms: number;
            started_at: string;
            ended_at: string;
            scores: {
                correctness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                user_outcome: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                robustness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                risk: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                overall_score: number;
                hard_gates_passed: boolean;
            };
            selected: boolean;
            deliverable?: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                content: string;
                artifacts: {
                    path: string;
                    hash: string;
                    content?: string | undefined;
                }[];
                metadata?: Record<string, any> | undefined;
            } | undefined;
            error_message?: string | undefined;
            selection_reason?: string | undefined;
        }, {
            status: "aborted" | "completed" | "timeout" | "errored";
            cost: {
                total_cost_usd: number;
                model_cost_usd: number;
                tool_cost_usd: number;
                sandbox_cost_usd: number;
            };
            task_id: string;
            config_id: string;
            attempt_id: string;
            sandbox_id: string;
            trace: {
                events: {
                    timestamp: string;
                    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                    data: Record<string, any>;
                    cost_usd?: number | undefined;
                }[];
                total_cost_usd: number;
                total_tokens: number;
                total_wall_time_ms: number;
            };
            wall_time_ms: number;
            started_at: string;
            ended_at: string;
            scores: {
                correctness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                user_outcome: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                robustness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                risk: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                overall_score: number;
                hard_gates_passed: boolean;
            };
            selected: boolean;
            deliverable?: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                content: string;
                artifacts: {
                    path: string;
                    hash: string;
                    content?: string | undefined;
                }[];
                metadata?: Record<string, any> | undefined;
            } | undefined;
            error_message?: string | undefined;
            selection_reason?: string | undefined;
        }>, "many">;
        winner: z.ZodString;
        merged_output: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
            content: z.ZodString;
            artifacts: z.ZodArray<z.ZodObject<{
                path: z.ZodString;
                content: z.ZodOptional<z.ZodString>;
                hash: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                path: string;
                hash: string;
                content?: string | undefined;
            }, {
                path: string;
                hash: string;
                content?: string | undefined;
            }>, "many">;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        }, {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        }>>;
        total_cost: z.ZodObject<{
            model_cost_usd: z.ZodNumber;
            tool_cost_usd: z.ZodNumber;
            sandbox_cost_usd: z.ZodNumber;
            total_cost_usd: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        }, {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        }>;
        total_wall_time_ms: z.ZodNumber;
        gbrain_write_status: z.ZodEnum<["pending", "written", "failed"]>;
        created_at: z.ZodString;
        completed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        created_at: string;
        total_wall_time_ms: number;
        task_bundle: {
            task_id: string;
            raw_description: string;
            signature: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            };
            priors: {
                similar_tasks: {
                    task_type: string;
                    surfaces: string[];
                    constraints: {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }[];
                    outcome_shape: {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    };
                    context_refs: {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }[];
                    hash: string;
                }[];
                winning_configs: {
                    win_rate: number;
                    n: number;
                    config?: any;
                }[];
                known_failure_modes: {
                    pattern: string;
                    frequency: number;
                    severity: "low" | "medium" | "high" | "critical";
                }[];
                recommended_n: number;
                user_preferences: Record<string, any>;
                domain_constraints: Record<string, any>;
            };
            budget: {
                max_attempts: number;
                max_cost_usd: number;
                max_wall_time_ms: number;
                max_parallelism: number;
            };
            created_at: string;
        };
        attempts: {
            status: "aborted" | "completed" | "timeout" | "errored";
            cost: {
                total_cost_usd: number;
                model_cost_usd: number;
                tool_cost_usd: number;
                sandbox_cost_usd: number;
            };
            task_id: string;
            config_id: string;
            attempt_id: string;
            sandbox_id: string;
            trace: {
                events: {
                    timestamp: string;
                    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                    data: Record<string, any>;
                    cost_usd?: number | undefined;
                }[];
                total_cost_usd: number;
                total_tokens: number;
                total_wall_time_ms: number;
            };
            wall_time_ms: number;
            started_at: string;
            ended_at: string;
            scores: {
                correctness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                user_outcome: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                robustness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                risk: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                overall_score: number;
                hard_gates_passed: boolean;
            };
            selected: boolean;
            deliverable?: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                content: string;
                artifacts: {
                    path: string;
                    hash: string;
                    content?: string | undefined;
                }[];
                metadata?: Record<string, any> | undefined;
            } | undefined;
            error_message?: string | undefined;
            selection_reason?: string | undefined;
        }[];
        winner: string;
        total_cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        gbrain_write_status: "pending" | "written" | "failed";
        completed_at: string;
        merged_output?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
    }, {
        task_id: string;
        created_at: string;
        total_wall_time_ms: number;
        task_bundle: {
            task_id: string;
            raw_description: string;
            signature: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            };
            priors: {
                similar_tasks: {
                    task_type: string;
                    surfaces: string[];
                    constraints: {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }[];
                    outcome_shape: {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    };
                    context_refs: {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }[];
                    hash: string;
                }[];
                winning_configs: {
                    win_rate: number;
                    n: number;
                    config?: any;
                }[];
                known_failure_modes: {
                    pattern: string;
                    frequency: number;
                    severity: "low" | "medium" | "high" | "critical";
                }[];
                recommended_n: number;
                user_preferences: Record<string, any>;
                domain_constraints: Record<string, any>;
            };
            budget: {
                max_attempts?: number | undefined;
                max_cost_usd?: number | undefined;
                max_wall_time_ms?: number | undefined;
                max_parallelism?: number | undefined;
            };
            created_at: string;
        };
        attempts: {
            status: "aborted" | "completed" | "timeout" | "errored";
            cost: {
                total_cost_usd: number;
                model_cost_usd: number;
                tool_cost_usd: number;
                sandbox_cost_usd: number;
            };
            task_id: string;
            config_id: string;
            attempt_id: string;
            sandbox_id: string;
            trace: {
                events: {
                    timestamp: string;
                    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                    data: Record<string, any>;
                    cost_usd?: number | undefined;
                }[];
                total_cost_usd: number;
                total_tokens: number;
                total_wall_time_ms: number;
            };
            wall_time_ms: number;
            started_at: string;
            ended_at: string;
            scores: {
                correctness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                user_outcome: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                robustness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                risk: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                overall_score: number;
                hard_gates_passed: boolean;
            };
            selected: boolean;
            deliverable?: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                content: string;
                artifacts: {
                    path: string;
                    hash: string;
                    content?: string | undefined;
                }[];
                metadata?: Record<string, any> | undefined;
            } | undefined;
            error_message?: string | undefined;
            selection_reason?: string | undefined;
        }[];
        winner: string;
        total_cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        gbrain_write_status: "pending" | "written" | "failed";
        completed_at: string;
        merged_output?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
    }>;
    priority: z.ZodDefault<z.ZodEnum<["low", "normal", "high"]>>;
}, "strip", z.ZodTypeAny, {
    priority: "low" | "high" | "normal";
    run_record: {
        task_id: string;
        created_at: string;
        total_wall_time_ms: number;
        task_bundle: {
            task_id: string;
            raw_description: string;
            signature: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            };
            priors: {
                similar_tasks: {
                    task_type: string;
                    surfaces: string[];
                    constraints: {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }[];
                    outcome_shape: {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    };
                    context_refs: {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }[];
                    hash: string;
                }[];
                winning_configs: {
                    win_rate: number;
                    n: number;
                    config?: any;
                }[];
                known_failure_modes: {
                    pattern: string;
                    frequency: number;
                    severity: "low" | "medium" | "high" | "critical";
                }[];
                recommended_n: number;
                user_preferences: Record<string, any>;
                domain_constraints: Record<string, any>;
            };
            budget: {
                max_attempts: number;
                max_cost_usd: number;
                max_wall_time_ms: number;
                max_parallelism: number;
            };
            created_at: string;
        };
        attempts: {
            status: "aborted" | "completed" | "timeout" | "errored";
            cost: {
                total_cost_usd: number;
                model_cost_usd: number;
                tool_cost_usd: number;
                sandbox_cost_usd: number;
            };
            task_id: string;
            config_id: string;
            attempt_id: string;
            sandbox_id: string;
            trace: {
                events: {
                    timestamp: string;
                    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                    data: Record<string, any>;
                    cost_usd?: number | undefined;
                }[];
                total_cost_usd: number;
                total_tokens: number;
                total_wall_time_ms: number;
            };
            wall_time_ms: number;
            started_at: string;
            ended_at: string;
            scores: {
                correctness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                user_outcome: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                robustness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                risk: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                overall_score: number;
                hard_gates_passed: boolean;
            };
            selected: boolean;
            deliverable?: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                content: string;
                artifacts: {
                    path: string;
                    hash: string;
                    content?: string | undefined;
                }[];
                metadata?: Record<string, any> | undefined;
            } | undefined;
            error_message?: string | undefined;
            selection_reason?: string | undefined;
        }[];
        winner: string;
        total_cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        gbrain_write_status: "pending" | "written" | "failed";
        completed_at: string;
        merged_output?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
    };
}, {
    run_record: {
        task_id: string;
        created_at: string;
        total_wall_time_ms: number;
        task_bundle: {
            task_id: string;
            raw_description: string;
            signature: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            };
            priors: {
                similar_tasks: {
                    task_type: string;
                    surfaces: string[];
                    constraints: {
                        type: "latency" | "cost" | "security" | "compliance" | "performance";
                        value: string;
                        operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                        priority: number;
                    }[];
                    outcome_shape: {
                        type: "code" | "document" | "deployment" | "research" | "config_change";
                        format: string;
                        validation_criteria: string[];
                    };
                    context_refs: {
                        ref_type: "page" | "entity" | "skill" | "pattern";
                        ref_id: string;
                        confidence: number;
                    }[];
                    hash: string;
                }[];
                winning_configs: {
                    win_rate: number;
                    n: number;
                    config?: any;
                }[];
                known_failure_modes: {
                    pattern: string;
                    frequency: number;
                    severity: "low" | "medium" | "high" | "critical";
                }[];
                recommended_n: number;
                user_preferences: Record<string, any>;
                domain_constraints: Record<string, any>;
            };
            budget: {
                max_attempts?: number | undefined;
                max_cost_usd?: number | undefined;
                max_wall_time_ms?: number | undefined;
                max_parallelism?: number | undefined;
            };
            created_at: string;
        };
        attempts: {
            status: "aborted" | "completed" | "timeout" | "errored";
            cost: {
                total_cost_usd: number;
                model_cost_usd: number;
                tool_cost_usd: number;
                sandbox_cost_usd: number;
            };
            task_id: string;
            config_id: string;
            attempt_id: string;
            sandbox_id: string;
            trace: {
                events: {
                    timestamp: string;
                    event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                    data: Record<string, any>;
                    cost_usd?: number | undefined;
                }[];
                total_cost_usd: number;
                total_tokens: number;
                total_wall_time_ms: number;
            };
            wall_time_ms: number;
            started_at: string;
            ended_at: string;
            scores: {
                correctness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                user_outcome: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                robustness: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                risk: {
                    confidence: number;
                    score: number;
                    evidence: string[];
                };
                overall_score: number;
                hard_gates_passed: boolean;
            };
            selected: boolean;
            deliverable?: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                content: string;
                artifacts: {
                    path: string;
                    hash: string;
                    content?: string | undefined;
                }[];
                metadata?: Record<string, any> | undefined;
            } | undefined;
            error_message?: string | undefined;
            selection_reason?: string | undefined;
        }[];
        winner: string;
        total_cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        gbrain_write_status: "pending" | "written" | "failed";
        completed_at: string;
        merged_output?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
    };
    priority?: "low" | "high" | "normal" | undefined;
}>;
export type GBrainWriteRequest = z.infer<typeof GBrainWriteRequestSchema>;
export declare const GMirrorScoringRequestSchema: z.ZodObject<{
    task: z.ZodObject<{
        task_id: z.ZodString;
        raw_description: z.ZodString;
        signature: z.ZodObject<{
            task_type: z.ZodString;
            surfaces: z.ZodArray<z.ZodString, "many">;
            constraints: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
                value: z.ZodString;
                operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
                priority: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }, {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }>, "many">;
            outcome_shape: z.ZodObject<{
                type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
                format: z.ZodString;
                validation_criteria: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            }, {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            }>;
            context_refs: z.ZodArray<z.ZodObject<{
                ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
                ref_id: z.ZodString;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }, {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }>, "many">;
            hash: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }, {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }>;
        priors: z.ZodObject<{
            similar_tasks: z.ZodArray<z.ZodObject<{
                task_type: z.ZodString;
                surfaces: z.ZodArray<z.ZodString, "many">;
                constraints: z.ZodArray<z.ZodObject<{
                    type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
                    value: z.ZodString;
                    operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
                    priority: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }, {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }>, "many">;
                outcome_shape: z.ZodObject<{
                    type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
                    format: z.ZodString;
                    validation_criteria: z.ZodArray<z.ZodString, "many">;
                }, "strip", z.ZodTypeAny, {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                }, {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                }>;
                context_refs: z.ZodArray<z.ZodObject<{
                    ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
                    ref_id: z.ZodString;
                    confidence: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }, {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }>, "many">;
                hash: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }, {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }>, "many">;
            winning_configs: z.ZodArray<z.ZodObject<{
                config: z.ZodAny;
                win_rate: z.ZodNumber;
                n: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                win_rate: number;
                n: number;
                config?: any;
            }, {
                win_rate: number;
                n: number;
                config?: any;
            }>, "many">;
            known_failure_modes: z.ZodArray<z.ZodObject<{
                pattern: z.ZodString;
                frequency: z.ZodNumber;
                severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
            }, "strip", z.ZodTypeAny, {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }, {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }>, "many">;
            recommended_n: z.ZodNumber;
            user_preferences: z.ZodRecord<z.ZodString, z.ZodAny>;
            domain_constraints: z.ZodRecord<z.ZodString, z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        }, {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        }>;
        budget: z.ZodObject<{
            max_attempts: z.ZodDefault<z.ZodNumber>;
            max_cost_usd: z.ZodDefault<z.ZodNumber>;
            max_wall_time_ms: z.ZodDefault<z.ZodNumber>;
            max_parallelism: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max_attempts: number;
            max_cost_usd: number;
            max_wall_time_ms: number;
            max_parallelism: number;
        }, {
            max_attempts?: number | undefined;
            max_cost_usd?: number | undefined;
            max_wall_time_ms?: number | undefined;
            max_parallelism?: number | undefined;
        }>;
        created_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts: number;
            max_cost_usd: number;
            max_wall_time_ms: number;
            max_parallelism: number;
        };
        created_at: string;
    }, {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts?: number | undefined;
            max_cost_usd?: number | undefined;
            max_wall_time_ms?: number | undefined;
            max_parallelism?: number | undefined;
        };
        created_at: string;
    }>;
    attempts: z.ZodArray<z.ZodObject<{
        attempt_id: z.ZodString;
        task_id: z.ZodString;
        config_id: z.ZodString;
        sandbox_id: z.ZodString;
        status: z.ZodEnum<["completed", "timeout", "errored", "aborted"]>;
        deliverable: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
            content: z.ZodString;
            artifacts: z.ZodArray<z.ZodObject<{
                path: z.ZodString;
                content: z.ZodOptional<z.ZodString>;
                hash: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                path: string;
                hash: string;
                content?: string | undefined;
            }, {
                path: string;
                hash: string;
                content?: string | undefined;
            }>, "many">;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        }, {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        }>>;
        trace: z.ZodObject<{
            events: z.ZodArray<z.ZodObject<{
                timestamp: z.ZodString;
                event_type: z.ZodEnum<["model_call", "tool_call", "file_mutation", "error", "checkpoint", "decision"]>;
                data: z.ZodRecord<z.ZodString, z.ZodAny>;
                cost_usd: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }, {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }>, "many">;
            total_cost_usd: z.ZodNumber;
            total_tokens: z.ZodNumber;
            total_wall_time_ms: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        }, {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        }>;
        cost: z.ZodObject<{
            model_cost_usd: z.ZodNumber;
            tool_cost_usd: z.ZodNumber;
            sandbox_cost_usd: z.ZodNumber;
            total_cost_usd: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        }, {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        }>;
        wall_time_ms: z.ZodNumber;
        started_at: z.ZodString;
        ended_at: z.ZodString;
        error_message: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "aborted" | "completed" | "timeout" | "errored";
        cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        task_id: string;
        config_id: string;
        attempt_id: string;
        sandbox_id: string;
        trace: {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        };
        wall_time_ms: number;
        started_at: string;
        ended_at: string;
        deliverable?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
        error_message?: string | undefined;
    }, {
        status: "aborted" | "completed" | "timeout" | "errored";
        cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        task_id: string;
        config_id: string;
        attempt_id: string;
        sandbox_id: string;
        trace: {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        };
        wall_time_ms: number;
        started_at: string;
        ended_at: string;
        deliverable?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
        error_message?: string | undefined;
    }>, "many">;
    scoring_profile: z.ZodString;
    budget_ms: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    attempts: {
        status: "aborted" | "completed" | "timeout" | "errored";
        cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        task_id: string;
        config_id: string;
        attempt_id: string;
        sandbox_id: string;
        trace: {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        };
        wall_time_ms: number;
        started_at: string;
        ended_at: string;
        deliverable?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
        error_message?: string | undefined;
    }[];
    task: {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts: number;
            max_cost_usd: number;
            max_wall_time_ms: number;
            max_parallelism: number;
        };
        created_at: string;
    };
    scoring_profile: string;
    budget_ms: number;
}, {
    attempts: {
        status: "aborted" | "completed" | "timeout" | "errored";
        cost: {
            total_cost_usd: number;
            model_cost_usd: number;
            tool_cost_usd: number;
            sandbox_cost_usd: number;
        };
        task_id: string;
        config_id: string;
        attempt_id: string;
        sandbox_id: string;
        trace: {
            events: {
                timestamp: string;
                event_type: "model_call" | "tool_call" | "file_mutation" | "error" | "checkpoint" | "decision";
                data: Record<string, any>;
                cost_usd?: number | undefined;
            }[];
            total_cost_usd: number;
            total_tokens: number;
            total_wall_time_ms: number;
        };
        wall_time_ms: number;
        started_at: string;
        ended_at: string;
        deliverable?: {
            type: "code" | "document" | "deployment" | "research" | "config_change";
            content: string;
            artifacts: {
                path: string;
                hash: string;
                content?: string | undefined;
            }[];
            metadata?: Record<string, any> | undefined;
        } | undefined;
        error_message?: string | undefined;
    }[];
    task: {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts?: number | undefined;
            max_cost_usd?: number | undefined;
            max_wall_time_ms?: number | undefined;
            max_parallelism?: number | undefined;
        };
        created_at: string;
    };
    scoring_profile: string;
    budget_ms?: number | undefined;
}>;
export type GMirrorScoringRequest = z.infer<typeof GMirrorScoringRequestSchema>;
export declare const GMirrorScoringResponseSchema: z.ZodObject<{
    score_set: z.ZodArray<z.ZodObject<{
        attempt_id: z.ZodString;
        scores: z.ZodObject<{
            correctness: z.ZodObject<{
                score: z.ZodNumber;
                confidence: z.ZodNumber;
                evidence: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                score: number;
                evidence: string[];
            }, {
                confidence: number;
                score: number;
                evidence: string[];
            }>;
            user_outcome: z.ZodObject<{
                score: z.ZodNumber;
                confidence: z.ZodNumber;
                evidence: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                score: number;
                evidence: string[];
            }, {
                confidence: number;
                score: number;
                evidence: string[];
            }>;
            robustness: z.ZodObject<{
                score: z.ZodNumber;
                confidence: z.ZodNumber;
                evidence: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                score: number;
                evidence: string[];
            }, {
                confidence: number;
                score: number;
                evidence: string[];
            }>;
            risk: z.ZodObject<{
                score: z.ZodNumber;
                confidence: z.ZodNumber;
                evidence: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                score: number;
                evidence: string[];
            }, {
                confidence: number;
                score: number;
                evidence: string[];
            }>;
            overall_score: z.ZodNumber;
            hard_gates_passed: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        }, {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        attempt_id: string;
        scores: {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        };
    }, {
        attempt_id: string;
        scores: {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        };
    }>, "many">;
    latency_ms: z.ZodNumber;
    simulated_user_coverage: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    score_set: {
        attempt_id: string;
        scores: {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        };
    }[];
    latency_ms: number;
    simulated_user_coverage: number;
}, {
    score_set: {
        attempt_id: string;
        scores: {
            correctness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            user_outcome: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            robustness: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            risk: {
                confidence: number;
                score: number;
                evidence: string[];
            };
            overall_score: number;
            hard_gates_passed: boolean;
        };
    }[];
    latency_ms: number;
    simulated_user_coverage: number;
}>;
export type GMirrorScoringResponse = z.infer<typeof GMirrorScoringResponseSchema>;
export declare const GToMConflictPredictionRequestSchema: z.ZodObject<{
    task: z.ZodObject<{
        task_id: z.ZodString;
        raw_description: z.ZodString;
        signature: z.ZodObject<{
            task_type: z.ZodString;
            surfaces: z.ZodArray<z.ZodString, "many">;
            constraints: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
                value: z.ZodString;
                operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
                priority: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }, {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }>, "many">;
            outcome_shape: z.ZodObject<{
                type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
                format: z.ZodString;
                validation_criteria: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            }, {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            }>;
            context_refs: z.ZodArray<z.ZodObject<{
                ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
                ref_id: z.ZodString;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }, {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }>, "many">;
            hash: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }, {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        }>;
        priors: z.ZodObject<{
            similar_tasks: z.ZodArray<z.ZodObject<{
                task_type: z.ZodString;
                surfaces: z.ZodArray<z.ZodString, "many">;
                constraints: z.ZodArray<z.ZodObject<{
                    type: z.ZodEnum<["latency", "cost", "security", "compliance", "performance"]>;
                    value: z.ZodString;
                    operator: z.ZodEnum<["<", ">", "<=", ">=", "=", "!="]>;
                    priority: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }, {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }>, "many">;
                outcome_shape: z.ZodObject<{
                    type: z.ZodEnum<["code", "document", "deployment", "research", "config_change"]>;
                    format: z.ZodString;
                    validation_criteria: z.ZodArray<z.ZodString, "many">;
                }, "strip", z.ZodTypeAny, {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                }, {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                }>;
                context_refs: z.ZodArray<z.ZodObject<{
                    ref_type: z.ZodEnum<["page", "entity", "skill", "pattern"]>;
                    ref_id: z.ZodString;
                    confidence: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }, {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }>, "many">;
                hash: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }, {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }>, "many">;
            winning_configs: z.ZodArray<z.ZodObject<{
                config: z.ZodAny;
                win_rate: z.ZodNumber;
                n: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                win_rate: number;
                n: number;
                config?: any;
            }, {
                win_rate: number;
                n: number;
                config?: any;
            }>, "many">;
            known_failure_modes: z.ZodArray<z.ZodObject<{
                pattern: z.ZodString;
                frequency: z.ZodNumber;
                severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
            }, "strip", z.ZodTypeAny, {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }, {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }>, "many">;
            recommended_n: z.ZodNumber;
            user_preferences: z.ZodRecord<z.ZodString, z.ZodAny>;
            domain_constraints: z.ZodRecord<z.ZodString, z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        }, {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        }>;
        budget: z.ZodObject<{
            max_attempts: z.ZodDefault<z.ZodNumber>;
            max_cost_usd: z.ZodDefault<z.ZodNumber>;
            max_wall_time_ms: z.ZodDefault<z.ZodNumber>;
            max_parallelism: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            max_attempts: number;
            max_cost_usd: number;
            max_wall_time_ms: number;
            max_parallelism: number;
        }, {
            max_attempts?: number | undefined;
            max_cost_usd?: number | undefined;
            max_wall_time_ms?: number | undefined;
            max_parallelism?: number | undefined;
        }>;
        created_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts: number;
            max_cost_usd: number;
            max_wall_time_ms: number;
            max_parallelism: number;
        };
        created_at: string;
    }, {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts?: number | undefined;
            max_cost_usd?: number | undefined;
            max_wall_time_ms?: number | undefined;
            max_parallelism?: number | undefined;
        };
        created_at: string;
    }>;
    active_attempts: z.ZodArray<z.ZodObject<{
        attempt_id: z.ZodString;
        config_id: z.ZodString;
        current_state: z.ZodRecord<z.ZodString, z.ZodAny>;
        recent_actions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        config_id: string;
        attempt_id: string;
        current_state: Record<string, any>;
        recent_actions: string[];
    }, {
        config_id: string;
        attempt_id: string;
        current_state: Record<string, any>;
        recent_actions: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    task: {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts: number;
            max_cost_usd: number;
            max_wall_time_ms: number;
            max_parallelism: number;
        };
        created_at: string;
    };
    active_attempts: {
        config_id: string;
        attempt_id: string;
        current_state: Record<string, any>;
        recent_actions: string[];
    }[];
}, {
    task: {
        task_id: string;
        raw_description: string;
        signature: {
            task_type: string;
            surfaces: string[];
            constraints: {
                type: "latency" | "cost" | "security" | "compliance" | "performance";
                value: string;
                operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                priority: number;
            }[];
            outcome_shape: {
                type: "code" | "document" | "deployment" | "research" | "config_change";
                format: string;
                validation_criteria: string[];
            };
            context_refs: {
                ref_type: "page" | "entity" | "skill" | "pattern";
                ref_id: string;
                confidence: number;
            }[];
            hash: string;
        };
        priors: {
            similar_tasks: {
                task_type: string;
                surfaces: string[];
                constraints: {
                    type: "latency" | "cost" | "security" | "compliance" | "performance";
                    value: string;
                    operator: "<" | ">" | "<=" | ">=" | "=" | "!=";
                    priority: number;
                }[];
                outcome_shape: {
                    type: "code" | "document" | "deployment" | "research" | "config_change";
                    format: string;
                    validation_criteria: string[];
                };
                context_refs: {
                    ref_type: "page" | "entity" | "skill" | "pattern";
                    ref_id: string;
                    confidence: number;
                }[];
                hash: string;
            }[];
            winning_configs: {
                win_rate: number;
                n: number;
                config?: any;
            }[];
            known_failure_modes: {
                pattern: string;
                frequency: number;
                severity: "low" | "medium" | "high" | "critical";
            }[];
            recommended_n: number;
            user_preferences: Record<string, any>;
            domain_constraints: Record<string, any>;
        };
        budget: {
            max_attempts?: number | undefined;
            max_cost_usd?: number | undefined;
            max_wall_time_ms?: number | undefined;
            max_parallelism?: number | undefined;
        };
        created_at: string;
    };
    active_attempts: {
        config_id: string;
        attempt_id: string;
        current_state: Record<string, any>;
        recent_actions: string[];
    }[];
}>;
export type GToMConflictPredictionRequest = z.infer<typeof GToMConflictPredictionRequestSchema>;
export declare const GToMConflictPredictionResponseSchema: z.ZodObject<{
    predicted_conflicts: z.ZodArray<z.ZodObject<{
        attempt_ids: z.ZodTuple<[z.ZodString, z.ZodString], null>;
        conflict_type: z.ZodEnum<["file", "resource", "semantic", "goal"]>;
        severity: z.ZodNumber;
        predicted_at_step: z.ZodOptional<z.ZodNumber>;
        recommended_action: z.ZodEnum<["reroute", "serialize", "merge", "ignore"]>;
    }, "strip", z.ZodTypeAny, {
        severity: number;
        attempt_ids: [string, string];
        conflict_type: "file" | "resource" | "semantic" | "goal";
        recommended_action: "reroute" | "serialize" | "merge" | "ignore";
        predicted_at_step?: number | undefined;
    }, {
        severity: number;
        attempt_ids: [string, string];
        conflict_type: "file" | "resource" | "semantic" | "goal";
        recommended_action: "reroute" | "serialize" | "merge" | "ignore";
        predicted_at_step?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    predicted_conflicts: {
        severity: number;
        attempt_ids: [string, string];
        conflict_type: "file" | "resource" | "semantic" | "goal";
        recommended_action: "reroute" | "serialize" | "merge" | "ignore";
        predicted_at_step?: number | undefined;
    }[];
}, {
    predicted_conflicts: {
        severity: number;
        attempt_ids: [string, string];
        conflict_type: "file" | "resource" | "semantic" | "goal";
        recommended_action: "reroute" | "serialize" | "merge" | "ignore";
        predicted_at_step?: number | undefined;
    }[];
}>;
export type GToMConflictPredictionResponse = z.infer<typeof GToMConflictPredictionResponseSchema>;
export declare const GStackSkillManifestSchema: z.ZodObject<{
    skill_id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    input_schema: z.ZodRecord<z.ZodString, z.ZodAny>;
    output_schema: z.ZodRecord<z.ZodString, z.ZodAny>;
    cost_estimate_usd: z.ZodNumber;
    typical_duration_ms: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    skill_id: string;
    name: string;
    description: string;
    input_schema: Record<string, any>;
    output_schema: Record<string, any>;
    cost_estimate_usd: number;
    typical_duration_ms: number;
}, {
    skill_id: string;
    name: string;
    description: string;
    input_schema: Record<string, any>;
    output_schema: Record<string, any>;
    cost_estimate_usd: number;
    typical_duration_ms: number;
}>;
export type GStackSkillManifest = z.infer<typeof GStackSkillManifestSchema>;
//# sourceMappingURL=index.d.ts.map