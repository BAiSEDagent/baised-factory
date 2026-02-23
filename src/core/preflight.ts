import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

export interface PreflightOptions {
  repoPath: string;
  baseRef: string;
  allowDirty?: boolean;
}

export interface PreflightResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  repoPath: string;
  baseRef: string;
  isClean: boolean;
  packageManager?: 'pnpm' | 'npm' | 'yarn';
}

/**
 * Preflight gate - hard fail on dirty repo / missing baseRef / non-git
 * This prevents 90% of one-shot shipping chaos
 */
export function runPreflight(opts: PreflightOptions): PreflightResult {
  const { repoPath, baseRef, allowDirty = false } = opts;
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Must be a git repo
  if (!existsSync(path.join(repoPath, '.git'))) {
    errors.push(`Preflight failed: not a git repo (${repoPath})`);
  }
  
  // 2. baseRef must exist
  try {
    execFileSync('git', ['rev-parse', '--verify', baseRef], { 
      cwd: repoPath,
      stdio: 'pipe'
    });
  } catch {
    errors.push(`Preflight failed: baseRef does not exist (${baseRef})`);
  }
  
  // 3. Must be clean unless allowDirty
  let isClean = true;
  if (!allowDirty) {
    try {
      const status = execFileSync('git', ['status', '--porcelain'], { 
        cwd: repoPath,
        stdio: 'pipe'
      }).toString().trim();
      
      if (status.length > 0) {
        isClean = false;
        errors.push('Preflight failed: working tree is dirty (commit/stash first)');
        errors.push(`Dirty files:\n${status}`);
      }
    } catch {
      warnings.push('Could not check git status');
    }
  }
  
  // 4. Detect package manager
  let packageManager: 'pnpm' | 'npm' | 'yarn' | undefined;
  if (existsSync(path.join(repoPath, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  } else if (existsSync(path.join(repoPath, 'yarn.lock'))) {
    packageManager = 'yarn';
  } else if (existsSync(path.join(repoPath, 'package-lock.json'))) {
    packageManager = 'npm';
  }
  
  if (!packageManager && existsSync(path.join(repoPath, 'package.json'))) {
    warnings.push('No lockfile detected - using npm by default');
    packageManager = 'npm';
  }
  
  // 5. Worktree root must be writable
  try {
    const testFile = path.join(repoPath, '.bmad-write-test');
    require('fs').writeFileSync(testFile, '');
    require('fs').unlinkSync(testFile);
  } catch {
    errors.push('Preflight failed: repo path is not writable');
  }
  
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    repoPath,
    baseRef,
    isClean,
    packageManager,
  };
}