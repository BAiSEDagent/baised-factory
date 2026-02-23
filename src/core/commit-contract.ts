/**
 * Commit Contract - Agents must commit, PM merges commits, not trees
 * 
 * This ensures:
 * 1. Clean worktrees at end (no uncommitted changes)
 * 2. Traceable history (each agent's work is a commit)
 * 3. Atomic merge (all commits or nothing)
 */

import { execSync } from 'child_process';

export interface CommitContract {
  agent: string;
  worktree: string;
  baseRef: string;
  headCommit: string;  // REQUIRED - agent must commit
  commitMessage: string;
  filesChanged: string[];
  isClean: boolean;    // Working tree must be clean
}

export interface CommitValidation {
  valid: boolean;
  errors: string[];
  headCommit?: string;
}

/**
 * Verify commit contract for a worktree
 * Called after agent finishes execution
 */
export function verifyCommitContract(
  worktreePath: string,
  agent: string,
  expectedBaseRef: string
): CommitValidation {
  const errors: string[] = [];
  
  try {
    // 1. Check if working tree is clean
    const status = execSync('git status --porcelain', { 
      cwd: worktreePath,
      encoding: 'utf-8'
    }).trim();
    
    if (status.length > 0) {
      errors.push(`Worktree is dirty:\n${status}`);
    }
    
    // 2. Get HEAD commit
    const headCommit = execSync('git rev-parse HEAD', {
      cwd: worktreePath,
      encoding: 'utf-8'
    }).trim();
    
    // 3. Check that HEAD is not same as baseRef (must have committed something)
    const baseCommit = execSync(`git rev-parse ${expectedBaseRef}`, {
      cwd: worktreePath,
      encoding: 'utf-8'
    }).trim();
    
    if (headCommit === baseCommit) {
      errors.push(`Agent made no commits (HEAD == ${expectedBaseRef})`);
    }
    
    // 4. Verify this is a valid commit
    try {
      execSync(`git cat-file -t ${headCommit}`, { cwd: worktreePath });
    } catch {
      errors.push(`Invalid commit: ${headCommit}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      headCommit: errors.length === 0 ? headCommit : undefined,
    };
    
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to verify commit contract: ${error}`],
    };
  }
}

/**
 * Force agent to commit before finishing
 * If dirty, commit with auto-message
 */
export function enforceCommit(
  worktreePath: string,
  agent: string,
  message?: string
): { success: boolean; commitHash?: string; error?: string } {
  try {
    // Check if dirty
    const status = execSync('git status --porcelain', {
      cwd: worktreePath,
      encoding: 'utf-8'
    }).trim();
    
    if (status.length === 0) {
      // Already clean, get current HEAD
      const headCommit = execSync('git rev-parse HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8'
      }).trim();
      
      return { success: true, commitHash: headCommit };
    }
    
    // Auto-commit dirty changes
    execSync('git add -A', { cwd: worktreePath });
    
    const commitMessage = message || `[${agent}] Auto-commit: ${status.split('\n').length} files changed`;
    
    execSync(`git commit -m "${commitMessage}"`, { cwd: worktreePath });
    
    const commitHash = execSync('git rev-parse HEAD', {
      cwd: worktreePath,
      encoding: 'utf-8'
    }).trim();
    
    return { success: true, commitHash };
    
  } catch (error) {
    return {
      success: false,
      error: `Failed to enforce commit: ${error}`,
    };
  }
}

/**
 * Merge commits atomically to target branch
 * All-or-nothing: either all commits merge, or none do
 */
export function mergeCommitsAtomic(
  repoPath: string,
  commits: { agent: string; commitHash: string; branch: string }[],
  target: string = 'main',
  mergeOrder?: string[]
): { success: boolean; finalCommit?: string; error?: string } {
  // Determine merge order
  let ordered = commits;
  if (mergeOrder) {
    ordered = mergeOrder
      .map(agent => commits.find(c => c.agent === agent))
      .filter(Boolean) as typeof commits;
  }
  
  // Default order: Backend -> Frontend -> QA -> Docs
  const defaultPriority: Record<string, number> = {
    'Backend': 1, 'API': 1, 'Database': 1,
    'Frontend': 2, 'UI': 2, 'UX': 2, 'Mobile': 2,
    'QA': 3, 'Test': 3, 'E2E': 3,
    'Docs': 4, 'Documentation': 4,
  };
  
  if (!mergeOrder) {
    ordered = [...commits].sort((a, b) => {
      const pa = defaultPriority[a.agent] || 2;
      const pb = defaultPriority[b.agent] || 2;
      return pa - pb;
    });
  }
  
  const merged: string[] = [];
  
  try {
    // Checkout target
    execSync(`git checkout ${target}`, { cwd: repoPath });
    
    // Merge each commit
    for (const { agent, commitHash, branch } of ordered) {
      console.log(`[PM] Merging ${agent}: ${commitHash.slice(0, 8)}`);
      
      try {
        // Cherry-pick the commit (cleaner than merging branch)
        execSync(`git cherry-pick ${commitHash} --no-commit`, { cwd: repoPath });
        
        // Commit with attribution
        execSync(`git commit -m "[${agent}] ${commitHash.slice(0, 8)}" --no-edit`, { 
          cwd: repoPath 
        });
        
        merged.push(commitHash);
        
      } catch (error) {
        // Abort on conflict
        try {
          execSync('git cherry-pick --abort', { cwd: repoPath });
        } catch {}
        
        return {
          success: false,
          error: `Merge conflict in ${agent} (${commitHash.slice(0, 8)}). Atomic merge aborted.`,
        };
      }
    }
    
    // Get final commit hash
    const finalCommit = execSync('git rev-parse HEAD', {
      cwd: repoPath,
      encoding: 'utf-8'
    }).trim();
    
    console.log(`[PM] Atomic merge complete: ${finalCommit.slice(0, 8)}`);
    
    return {
      success: true,
      finalCommit,
    };
    
  } catch (error) {
    // Rollback: reset to original target
    try {
      execSync(`git reset --hard ${target}`, { cwd: repoPath });
    } catch {}
    
    return {
      success: false,
      error: `Atomic merge failed: ${error}`,
    };
  }
}