/**
 * Artifact Manifest Protocol
 * Every agent must output this structure
 */

export interface ArtifactManifest {
  agent: string;
  worktree: string;
  summary: string;
  filesChanged: string[];
  commandsRun: string[];
  testStatus: 'pass' | 'fail' | 'skipped';
  notes: string[];
  riskFlags: RiskFlag[];
  timestamp: number;
}

export type RiskFlag = 
  | 'touches-auth'
  | 'db-migration'
  | 'api-change'
  | 'breaking-change'
  | 'secrets'
  | 'performance'
  | 'security';

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
  
  // Files changed
  if (!Array.isArray(manifest.filesChanged)) {
    errors.push('filesChanged must be an array');
  } else if (manifest.filesChanged.length === 0) {
    warnings.push('No files changed');
  }
  
  // Test status
  const validStatuses = ['pass', 'fail', 'skipped'];
  if (!validStatuses.includes(manifest.testStatus)) {
    errors.push(`testStatus must be one of: ${validStatuses.join(', ')}`);
  }
  
  // Warnings for risky flags
  if (manifest.riskFlags?.includes('touches-auth')) {
    warnings.push('Authentication changes require security review');
  }
  if (manifest.riskFlags?.includes('db-migration')) {
    warnings.push('Database migrations require rollback plan');
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
    summary,
    filesChanged,
    commandsRun: options.commandsRun || [],
    testStatus: options.testStatus || 'skipped',
    notes: options.notes || [],
    riskFlags: options.riskFlags || [],
    timestamp: Date.now(),
  };
}