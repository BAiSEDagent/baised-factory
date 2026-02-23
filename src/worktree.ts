import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface Worktree {
  path: string;
  branch: string;
  baseRef: string;
  createdAt: number;
}

export class WorktreeManager {
  private baseDir: string;
  private worktrees: Map<string, Worktree> = new Map();
  
  constructor(baseDir: string = '/tmp/baised-factory-worktrees') {
    this.baseDir = baseDir;
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }
  }
  
  /**
   * Spawn a new isolated worktree for an agent
   */
  spawn(branchName: string, baseRef: string = 'main'): Worktree {
    const worktreePath = join(this.baseDir, branchName);
    
    // Clean up if exists
    if (existsSync(worktreePath)) {
      this.cleanup(branchName);
    }
    
    // Create worktree
    try {
      execSync(`git worktree add -b ${branchName} ${worktreePath} ${baseRef}`, {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
    } catch (error) {
      // Branch might exist, try without -b
      execSync(`git worktree add ${worktreePath} ${branchName}`, {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
    }
    
    const worktree: Worktree = {
      path: worktreePath,
      branch: branchName,
      baseRef,
      createdAt: Date.now(),
    };
    
    this.worktrees.set(branchName, worktree);
    console.log(`[WorktreeManager] Spawned ${branchName} at ${worktreePath}`);
    
    return worktree;
  }
  
  /**
   * Clean up a worktree
   */
  cleanup(branchName: string): void {
    const worktree = this.worktrees.get(branchName);
    if (!worktree) return;
    
    try {
      // Remove worktree
      execSync(`git worktree remove ${worktree.path} --force`, {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      // Delete branch
      execSync(`git branch -D ${branchName}`, {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      this.worktrees.delete(branchName);
      console.log(`[WorktreeManager] Cleaned up ${branchName}`);
    } catch (error) {
      console.warn(`[WorktreeManager] Cleanup failed for ${branchName}:`, error);
    }
  }
  
  /**
   * List all active worktrees
   */
  list(): Worktree[] {
    return Array.from(this.worktrees.values());
  }
  
  /**
   * Get worktree by branch name
   */
  get(branchName: string): Worktree | undefined {
    return this.worktrees.get(branchName);
  }
  
  /**
   * Check if worktree exists
   */
  exists(branchName: string): boolean {
    return this.worktrees.has(branchName);
  }
  
  /**
   * Clean up all worktrees
   */
  cleanupAll(): void {
    for (const branchName of this.worktrees.keys()) {
      this.cleanup(branchName);
    }
  }
}