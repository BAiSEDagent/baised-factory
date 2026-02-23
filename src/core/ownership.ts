/**
 * Ownership Map - Conflict prevention, not just detection
 * 
 * Enforces file ownership before spawning worktrees
 * Prevents parallel chaos by design
 */

export interface OwnershipConfig {
  strict: boolean;
  generatedPaths: string[];     // Ignored in conflict detection
  allowSharedPaths: string[];   // Multiple agents can touch
  restrictedPaths: string[];    // PM-only, agents propose changes
  owners: Record<string, string[]>;  // agent -> path globs
  lockfileOwner?: string;       // Single agent owns lockfiles
}

export interface PlannedChange {
  agent: string;
  files: string[];
}

export interface OwnershipCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  conflicts: string[];
  violations: string[];
}

// Default ownership map for typical monorepo
export const DEFAULT_OWNERSHIP: OwnershipConfig = {
  strict: true,
  generatedPaths: ['dist/', 'build/', '.next/', 'out/', 'coverage/', 'node_modules/'],
  allowSharedPaths: ['docs/', 'README.md', 'CHANGELOG.md'],
  restrictedPaths: [
    'shared/',
    'package.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.base.json',
    '.eslintrc',
    '.prettierrc',
    'turbo.json',
    'nx.json',
  ],
  owners: {
    Frontend: ['apps/web/', 'apps/mobile/', 'packages/ui/'],
    Backend: ['apps/api/', 'apps/server/', 'packages/core/', 'db/', 'prisma/'],
    QA: ['tests/', 'e2e/', 'playwright/', 'cypress/'],
    Docs: ['docs/', 'README.md', 'CONTRIBUTING.md'],
    Infra: ['terraform/', 'docker/', 'k8s/', '.github/'],
  },
  lockfileOwner: 'Backend',
};

/**
 * Simple glob matching (supports * and **)
 */
function matchesGlob(file: string, pattern: string): boolean {
  // Convert glob to regex
  const regex = pattern
    .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<DOUBLESTAR>>>/g, '.*');
  
  const reg = new RegExp(`^${regex}`);
  return reg.test(file);
}

/**
 * Check if file matches any pattern in list
 */
function matchesAny(file: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchesGlob(file, pattern));
}

/**
 * Get owners for a file
 */
function getOwners(file: string, config: OwnershipConfig): string[] {
  const owners: string[] = [];
  
  for (const [agent, patterns] of Object.entries(config.owners)) {
    if (matchesAny(file, patterns)) {
      owners.push(agent);
    }
  }
  
  return owners;
}

/**
 * Check ownership of planned changes
 * Called by Router BEFORE spawning worktrees
 */
export function checkOwnership(
  plan: PlannedChange[],
  config: OwnershipConfig = DEFAULT_OWNERSHIP
): OwnershipCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const conflicts: string[] = [];
  const violations: string[] = [];
  
  // Build reverse map: file -> agents touching
  const touched = new Map<string, Set<string>>();
  
  for (const p of plan) {
    for (const file of p.files) {
      // Skip generated paths
      if (matchesAny(file, config.generatedPaths)) {
        continue;
      }
      
      const set = touched.get(file) ?? new Set<string>();
      set.add(p.agent);
      touched.set(file, set);
    }
  }
  
  // Check each file
  for (const [file, agents] of touched.entries()) {
    // Allowed shared paths don't conflict
    if (matchesAny(file, config.allowSharedPaths)) {
      continue;
    }
    
    // Multiple agents touching same file = conflict
    if (agents.size > 1) {
      const agentList = Array.from(agents).join(', ');
      conflicts.push(`${file} touched by multiple agents: ${agentList}`);
      
      if (config.strict) {
        errors.push(`CONFLICT: ${file} cannot be modified by multiple agents in parallel mode`);
      }
    }
    
    // Check restricted paths
    if (matchesAny(file, config.restrictedPaths)) {
      const agent = Array.from(agents)[0];
      violations.push(`${file} is RESTRICTED - ${agent} cannot modify directly (PM-only)`);
      
      if (config.strict) {
        errors.push(`RESTRICTED: ${file} requires PM approval`);
      }
    }
    
    // Check ownership violations
    const fileOwners = getOwners(file, config);
    for (const agent of agents) {
      // If agent has no ownership claim and file isn't shared/restricted
      if (fileOwners.length > 0 && !fileOwners.includes(agent)) {
        const expected = fileOwners.join(' or ');
        violations.push(`${file} owned by ${expected} but touched by ${agent}`);
        
        if (config.strict) {
          errors.push(`OWNERSHIP: ${agent} cannot modify ${file} (owned by ${expected})`);
        }
      }
    }
    
    // Check lockfile ownership
    if (config.lockfileOwner) {
      const isLockfile = file.includes('lock') || file.includes('pnpm') || file.includes('yarn');
      if (isLockfile) {
        for (const agent of agents) {
          if (agent !== config.lockfileOwner) {
            violations.push(`${file} is lockfile, only ${config.lockfileOwner} should modify`);
            if (config.strict) {
              errors.push(`LOCKFILE: ${agent} cannot modify ${file} (owned by ${config.lockfileOwner})`);
            }
          }
        }
      }
    }
  }
  
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    conflicts,
    violations,
  };
}

/**
 * Validate that a parallel plan is safe
 * Router calls this before spawning worktrees
 */
export function validateParallelPlan(
  plan: PlannedChange[],
  config?: OwnershipConfig
): { safe: boolean; result: OwnershipCheckResult } {
  const result = checkOwnership(plan, config);
  
  // Parallel is safe if:
  // - No conflicts
  // - No ownership violations (in strict mode)
  // - No restricted path violations
  const safe = result.conflicts.length === 0 && 
               result.violations.length === 0 &&
               result.errors.length === 0;
  
  return { safe, result };
}

/**
 * Enforce ownership or throw hard error
 * Use in Router before spawning worktrees
 */
export function enforceOwnershipOrThrow(
  plan: PlannedChange[],
  cfg: OwnershipConfig
): OwnershipCheckResult {
  const res = checkOwnership(plan, cfg);
  if (!res.ok) {
    throw new Error(
      `Ownership check failed:\n- ${res.errors.join("\n- ")}`
    );
  }
  return res; // includes warnings
}