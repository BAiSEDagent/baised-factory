/**
 * BMAD Factory v1.2 - Worktree Isolation + PM Merge
 * 
 * One-shot shipping with parallel department agents
 */

import { Router } from './agents/router';
import { ProjectLead } from './agents/project-lead';
import { ResearchLead } from './agents/research-lead';
import { Improver } from './agents/improver';
import { Persistence, Pipeline, Task } from './persistence';
import { ProjectManager } from './pm';
import { WorktreeManager } from './worktree';
import { ArtifactManifest, createManifest } from './manifest';
import { Pipeline as PipelineConfig, Task as TaskConfig, Result } from './agents/types';

export { ArtifactManifest, WorktreeManager, ProjectManager };

export class BMADFactory {
  private router: Router;
  private persistence: Persistence;
  private pm: ProjectManager;
  private worktreeManager: WorktreeManager;
  private initialized: boolean = false;
  
  constructor(worktreeBaseDir?: string) {
    this.router = new Router();
    this.persistence = new Persistence();
    this.pm = new ProjectManager();
    this.worktreeManager = new WorktreeManager(worktreeBaseDir);
  }
  
  async initialize(dbPath?: string): Promise<void> {
    await this.persistence.initialize(dbPath);
    
    this.router.register('ProjectLead', new ProjectLead());
    this.router.register('ResearchLead', new ResearchLead());
    this.router.register('Improver', new Improver());
    
    this.initialized = true;
    console.log('✅ BMAD Factory v1.2 initialized (worktree isolation + PM merge)');
  }
  
  /**
   * Execute with worktree isolation
   */
  async execute(
    taskConfig: TaskConfig,
    options: {
      pipeline?: PipelineConfig;
      parallel?: boolean;
      agents?: string[];
    } = {}
  ): Promise<{
    pipelineId: string;
    worktrees: string[];
    commitHash?: string;
    manifests: ArtifactManifest[];
    success: boolean;
    error?: string;
  }> {
    if (!this.initialized) {
      throw new Error('BMADFactory not initialized');
    }
    
    const pipelineId = `pipeline_${Date.now()}`;
    const worktrees: string[] = [];
    const manifests: ArtifactManifest[] = [];
    
    console.log(`🚀 BMAD v1.2 Pipeline: ${pipelineId}`);
    console.log(`📋 Task: ${taskConfig.description}`);
    
    try {
      // Phase 1: PLAN - Project Lead breaks down work
      console.log('\n📍 Phase 1: PLAN');
      const planResult = await this.runAgentWithWorktree(
        'ProjectLead',
        'plan',
        taskConfig,
        pipelineId
      );
      
      const subtasks = planResult.data || [];
      console.log(`  Planned ${subtasks.length} subtasks`);
      
      // Phase 2: RESEARCH - Research Lead discovers solutions
      console.log('\n📍 Phase 2: RESEARCH');
      const researchResult = await this.runAgentWithWorktree(
        'ResearchLead',
        'research',
        taskConfig,
        pipelineId
      );
      
      console.log(`  Recommendation: ${researchResult.data?.bestChoice || 'N/A'}`);
      
      // Phase 3: PARALLEL IMPLEMENTATION - Department agents
      console.log('\n📍 Phase 3: PARALLEL IMPLEMENT');
      
      const departmentAgents = options.agents || ['Frontend', 'Backend'];
      
      if (options.parallel) {
        // Run all departments in parallel
        const departmentPromises = departmentAgents.map(agent => 
          this.runAgentWithWorktree(agent, 'implement', taskConfig, pipelineId)
        );
        
        const results = await Promise.all(departmentPromises);
        
        for (const result of results) {
          if (result.manifest) manifests.push(result.manifest);
          if (result.worktree) worktrees.push(result.worktree);
        }
      } else {
        // Sequential for now
        for (const agent of departmentAgents) {
          const result = await this.runAgentWithWorktree(agent, 'implement', taskConfig, pipelineId);
          if (result.manifest) manifests.push(result.manifest);
          if (result.worktree) worktrees.push(result.worktree);
        }
      }
      
      // Phase 4: PM REVIEW + MERGE
      console.log('\n📍 Phase 4: PM REVIEW & MERGE');
      
      const review = this.pm.review(manifests);
      
      console.log(`  Conflicts: ${review.conflicts.length}`);
      console.log(`  Errors: ${review.errors.length}`);
      console.log(`  Warnings: ${review.warnings.length}`);
      console.log(`  Risk: ${review.riskAssessment.level}`);
      
      if (!review.approved) {
        throw new Error(`Review failed: ${review.errors.join(', ')}`);
      }
      
      // Merge to main
      const worktreeObjs = worktrees.map(w => this.worktreeManager.get(w)!).filter(Boolean);
      const mergeResult = this.pm.merge(worktreeObjs, manifests, 'main');
      
      if (!mergeResult.success) {
        throw new Error(`Merge failed: ${mergeResult.error}`);
      }
      
      console.log('\n✅ Pipeline complete!');
      console.log(`   Commit: ${mergeResult.commitHash}`);
      
      // Cleanup worktrees
      for (const wt of worktrees) {
        this.worktreeManager.cleanup(wt);
      }
      
      return {
        pipelineId,
        worktrees,
        commitHash: mergeResult.commitHash,
        manifests,
        success: true,
      };
      
    } catch (error) {
      console.error('\n❌ Pipeline failed:', error);
      
      // Cleanup on failure
      for (const wt of worktrees) {
        this.worktreeManager.cleanup(wt);
      }
      
      return {
        pipelineId,
        worktrees,
        manifests,
        success: false,
        error: String(error),
      };
    }
  }
  
  private async runAgentWithWorktree(
    agentName: string,
    stage: string,
    taskConfig: TaskConfig,
    pipelineId: string
  ): Promise<{ success: boolean; data?: any; manifest?: ArtifactManifest; worktree?: string }> {
    // Spawn worktree
    const branchName = `${pipelineId}_${agentName.toLowerCase()}`;
    const worktree = this.worktreeManager.spawn(branchName, 'main');
    
    console.log(`  [${agentName}] Spawning worktree: ${branchName}`);
    
    // Run agent in worktree
    const agent = this.router.getAgent(agentName);
    const task: TaskConfig = {
      ...taskConfig,
      id: `${pipelineId}_${agentName}`,
      type: stage,
    };
    
    try {
      const result = await agent.execute(task);
      
      // Generate manifest from result
      const manifest = createManifest(
        agentName,
        branchName,
        result.success ? `Completed ${stage}` : `Failed: ${result.error}`,
        result.data?.filesChanged || [],
        {
          testStatus: result.success ? 'pass' : 'fail',
          notes: result.logs || [],
          riskFlags: result.data?.riskFlags || [],
        }
      );
      
      return {
        success: result.success,
        data: result.data,
        manifest,
        worktree: branchName,
      };
      
    } catch (error) {
      return {
        success: false,
        manifest: createManifest(
          agentName,
          branchName,
          `Error: ${error}`,
          [],
          { testStatus: 'fail', notes: [String(error)] }
        ),
        worktree: branchName,
      };
    }
  }
  
  async getStatus(): Promise<any> {
    return {
      worktrees: this.worktreeManager.list().length,
      runningPipelines: (await this.persistence.getRunningPipelines()).length,
      routerStatus: await this.router.getStatus(),
    };
  }
}