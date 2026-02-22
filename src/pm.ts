import { execSync } from 'child_process';
import { ArtifactManifest, detectConflicts, validateManifest } from './manifest';
import { Worktree } from './worktree';

export interface ReviewResult {
  approved: boolean;
  conflicts: string[];
  errors: string[];
  warnings: string[];
  riskAssessment: RiskAssessment;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  concerns: string[];
}

export interface MergeResult {
  success: boolean;
  commitHash?: string;
  error?: string;
  manifests: ArtifactManifest[];
}

export class ProjectManager {
  private strictMode: boolean = true;
  
  /**
   * Review manifests before merge
   * Strict mode: any conflict = rejection
   */
  review(manifests: ArtifactManifest[]): ReviewResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const concerns: string[] = [];
    
    // Validate each manifest
    for (const manifest of manifests) {
      const validation = validateManifest(manifest);
      if (!validation.valid) {
        errors.push(...validation.errors.map(e => `${manifest.agent}: ${e}`));
      }
      warnings.push(...validation.warnings.map(w => `${manifest.agent}: ${w}`));
    }
    
    // Detect file conflicts
    const conflicts = detectConflicts(manifests);
    if (conflicts.length > 0) {
      errors.push(...conflicts);
      concerns.push(`${conflicts.length} file conflicts detected`);
    }
    
    // Check for test failures
    const failedTests = manifests.filter(m => m.testStatus === 'fail');
    if (failedTests.length > 0) {
      errors.push(
        ...failedTests.map(m => `${m.agent}: Tests failed`)
      );
      concerns.push('Test failures in one or more worktrees');
    }
    
    // Risk assessment
    const riskFlags = manifests.flatMap(m => m.riskFlags || []);
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (riskFlags.includes('breaking-change')) {
      riskLevel = 'critical';
      concerns.push('Breaking changes require major version bump');
    } else if (riskFlags.includes('db-migration')) {
      riskLevel = 'high';
      concerns.push('Database migrations require rollback testing');
    } else if (riskFlags.includes('touches-auth') || riskFlags.includes('security')) {
      riskLevel = 'high';
      concerns.push('Security-related changes require audit');
    } else if (riskFlags.length > 0) {
      riskLevel = 'medium';
    }
    
    const approved = this.strictMode 
      ? errors.length === 0 
      : errors.filter(e => !e.startsWith('CONFLICT:')).length === 0;
    
    return {
      approved,
      conflicts,
      errors,
      warnings,
      riskAssessment: {
        level: riskLevel,
        concerns,
      },
    };
  }
  
  /**
   * Merge worktrees to target branch
   * Strict mode: No conflicts allowed
   */
  merge(worktrees: Worktree[], manifests: ArtifactManifest[], target: string = 'main'): MergeResult {
    // Pre-flight review
    const review = this.review(manifests);
    
    if (!review.approved) {
      return {
        success: false,
        error: `Merge rejected: ${review.errors.join(', ')}`,
        manifests,
      };
    }
    
    try {
      // Checkout target
      execSync(`git checkout ${target}`, { stdio: 'pipe' });
      
      // Merge each worktree in order
      const mergeOrder = this.determineMergeOrder(manifests);
      const mergedCommits: string[] = [];
      
      for (const branchName of mergeOrder) {
        console.log(`[PM] Merging ${branchName} into ${target}`);
        
        try {
          // Attempt merge
          execSync(`git merge ${branchName} --no-ff -m "Merge ${branchName}"`, {
            stdio: 'pipe'
          });
          
          // Get commit hash
          const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
          mergedCommits.push(commitHash);
          
        } catch (error) {
          // Merge conflict - abort and fail
          execSync('git merge --abort', { stdio: 'pipe' });
          
          return {
            success: false,
            error: `Merge conflict in ${branchName}. Aborting.`,
            manifests,
          };
        }
      }
      
      const finalCommit = mergedCommits[mergedCommits.length - 1];
      
      console.log(`[PM] Successfully merged ${worktrees.length} worktrees`);
      console.log(`[PM] Final commit: ${finalCommit}`);
      
      return {
        success: true,
        commitHash: finalCommit,
        manifests,
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Merge failed: ${error}`,
        manifests,
      };
    }
  }
  
  /**
   * Determine merge order based on dependencies
   */
  private determineMergeOrder(manifests: ArtifactManifest[]): string[] {
    // Simple order: API first, then UI, then tests
    const priority: Record<string, number> = {
      'Backend': 1,
      'API': 1,
      'Database': 1,
      'Frontend': 2,
      'UI': 2,
      'UX': 2,
      'QA': 3,
      'Test': 3,
    };
    
    return manifests
      .map(m => m.worktree)
      .sort((a, b) => {
        const pa = priority[manifests.find(m => m.worktree === a)?.agent || ''] || 2;
        const pb = priority[manifests.find(m => m.worktree === b)?.agent || ''] || 2;
        return pa - pb;
      });
  }
  
  /**
   * Enable/disable strict mode
   */
  setStrictMode(strict: boolean): void {
    this.strictMode = strict;
    console.log(`[PM] Strict mode ${strict ? 'enabled' : 'disabled'}`);
  }
}