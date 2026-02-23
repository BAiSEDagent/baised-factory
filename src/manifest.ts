/**
 * Artifact Manifest Protocol (v1.3.0)
 * 
 * Every agent must output this structure.
 * Schema-validated, machine-readable, audit-trail ready.
 */

export interface ArtifactManifest {
  agent: string;
  worktree: string;
  baseRef: string;
  headCommit: string;
  noOp?: boolean;  // If true, agent made no code changes (valid for QA, Research)
  summary: string;
  filesChanged: string[];
  commandsRun: string[];
  gates: {
    lint?: 'pass' | 'fail' | 'skipped';
    typecheck?: 'pass' | 'fail' | 'skipped';
    unitTest?: 'pass' | 'fail' | 'skipped';
    e2eTest?: 'pass' | 'fail' | 'skipped';
    docs?: 'pass' | 'fail' | 'skipped';
  };
  testStatus: 'pass' | 'fail' | 'skipped';
  notes: string[];
  riskFlags: RiskFlag[];
  timestamp: number;
}

export type RiskFlag = 
  | 'touches-auth'
  | 'db-migration'
  | 'breaking-change'
  | 'security-sensitive'
  | 'performance-critical';

export interface ManifestValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate artifact manifest structure
 */
export function validateManifest(manifest: any): ManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!manifest.agent) errors.push('Missing required field: agent');
  if (!manifest.worktree) errors.push('Missing required field: worktree');
  if (!manifest.summary) errors.push('Missing required field: summary');
  if (!manifest.headCommit) errors.push('Missing required field: headCommit (agent must commit)');
  
  // Files changed
  if (!Array.isArray(manifest.filesChanged)) {
    errors.push('filesChanged must be an array');
  }
  
  // Test status
  const validStatuses = ['pass', 'fail', 'skipped'];
  if (!validStatuses.includes(manifest.testStatus)) {
    errors.push(`testStatus must be one of: ${validStatuses.join(', ')}`);
  }
  
  // Risk flag validation
  const validRiskFlags: RiskFlag[] = [
    'touches-auth',
    'db-migration',
    'breaking-change',
    'security-sensitive',
    'performance-critical',
  ];
  
  if (manifest.riskFlags) {
    for (const flag of manifest.riskFlags) {
      if (!validRiskFlags.includes(flag)) {
        warnings.push(`Unknown risk flag: ${flag}`);
      }
    }
  }
  
  // Warnings for risky combinations
  if (manifest.riskFlags?.includes('touches-auth') && manifest.riskFlags?.includes('breaking-change')) {
    warnings.push('CRITICAL: Authentication + breaking change requires security review');
  }
  
  if (manifest.riskFlags?.includes('db-migration') && manifest.testStatus === 'fail') {
    errors.push('BLOCKING: Database migration with failing tests');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check for file conflicts between manifests
 */
export function detectConflicts(manifests: ArtifactManifest[]): string[] {
  const conflicts: string[] = [];
  const fileToManifest = new Map<string, string>();
  
  for (const manifest of manifests) {
    // Skip noOp manifests (no file changes)
    if (manifest.noOp) continue;
    
    for (const file of manifest.filesChanged) {
      if (fileToManifest.has(file)) {
        const otherAgent = fileToManifest.get(file)!;
        conflicts.push(
          `CONFLICT: ${file} touched by both ${manifest.agent} and ${otherAgent}`
        );
      } else {
        fileToManifest.set(file, manifest.agent);
      }
    }
  }
  
  return conflicts;
}

/**
 * Create a manifest from agent execution result
 */
export function createManifest(
  agent: string,
  worktree: string,
  summary: string,
  filesChanged: string[],
  options: Partial<ArtifactManifest> = {}
): ArtifactManifest {
  return {
    agent,
    worktree,
    baseRef: options.baseRef || 'main',
    headCommit: options.headCommit || 'UNKNOWN',
    noOp: options.noOp || (filesChanged.length === 0 && !options.headCommit),
    summary,
    filesChanged,
    commandsRun: options.commandsRun || [],
    gates: options.gates || {},
    testStatus: options.testStatus || 'skipped',
    notes: options.notes || [],
    riskFlags: options.riskFlags || [],
    timestamp: Date.now(),
  };
}