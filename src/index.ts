/**
 * BMAD Factory - Main Orchestrator with LLM + Persistence
 * 
 * Usage:
 *   const factory = new BMADFactory();
 *   await factory.initialize();
 *   
 *   const result = await factory.execute({
 *     type: 'feature',
 *     description: 'Add user authentication',
 *     requirements: ['OAuth2 login', 'JWT tokens', 'Session management']
 *   });
 */

import { Router } from './agents/router';
import { ProjectLead } from './agents/project-lead';
import { ResearchLead } from './agents/research-lead';
import { Improver } from './agents/improver';
import { Persistence, Pipeline, Task } from './persistence';
import { Pipeline as PipelineConfig, Task as TaskConfig, Result } from './agents/types';

export class BMADFactory {
  private router: Router;
  private persistence: Persistence;
  private initialized: boolean = false;
  
  // Default pipeline: Plan → Research → Implement → Test → Ship
  private defaultPipeline: PipelineConfig = {
    name: 'standard',
    stages: [
      { name: 'requirements', agent: 'ProjectLead', gates: [] },
      { name: 'research', agent: 'ResearchLead', gates: [] },
      { name: 'plan', agent: 'ProjectLead', gates: [] },
      { name: 'implement', agent: 'ProjectLead', gates: [] },
      { name: 'test', agent: 'ProjectLead', gates: [] },
      { name: 'ship', agent: 'ProjectLead', gates: [] },
    ]
  };
  
  constructor() {
    this.router = new Router();
    this.persistence = new Persistence();
  }
  
  async initialize(dbPath?: string): Promise<void> {
    // Initialize persistence
    await this.persistence.initialize(dbPath);
    
    // Register LLM-powered agents
    this.router.register('ProjectLead', new ProjectLead());
    this.router.register('ResearchLead', new ResearchLead());
    this.router.register('Improver', new Improver());
    
    this.initialized = true;
    console.log('✅ BMAD Factory initialized with LLM + Persistence');
  }
  
  async execute(taskConfig: TaskConfig, pipeline?: PipelineConfig): Promise<Result> {
    if (!this.initialized) {
      throw new Error('BMADFactory not initialized. Call initialize() first.');
    }
    
    const pipelineConfig = pipeline || this.defaultPipeline;
    const pipelineId = `pipeline_${Date.now()}`;
    
    // Create pipeline record
    await this.persistence.createPipeline({
      id: pipelineId,
      name: pipelineConfig.name,
      status: 'running',
      currentStage: pipelineConfig.stages[0]?.name || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    console.log(`🚀 Starting pipeline: ${pipelineConfig.name} (${pipelineId})`);
    console.log(`📋 Task: ${taskConfig.description}`);
    
    const results: Result[] = [];
    
    for (const stage of pipelineConfig.stages) {
      console.log(`\n📍 Stage: ${stage.name} (${stage.agent})`);
      
      // Update pipeline current stage
      await this.persistence.updatePipeline(pipelineId, {
        currentStage: stage.name,
      });
      
      const taskId = `${pipelineId}_${stage.name}`;
      
      // Create task record
      const task: Task = {
        id: taskId,
        pipelineId: pipelineId,
        stage: stage.name,
        agent: stage.agent,
        description: taskConfig.description,
        type: stage.name,
        critical: taskConfig.critical || false,
        status: 'running',
        data: JSON.stringify(taskConfig.data || {}),
        createdAt: Date.now(),
      };
      
      await this.persistence.createTask(task);
      
      try {
        const stageTask: TaskConfig = {
          ...taskConfig,
          id: taskId,
          type: stage.name,
        };
        
        // Execute quality gates
        for (const gate of stage.gates) {
          console.log(`  🔍 Gate: ${gate.name}`);
          const passed = await this.runGate(gate, stageTask);
          if (!passed) {
            throw new Error(`Quality gate failed: ${gate.name}`);
          }
        }
        
        // Route to agent
        const result = await this.router.route(stageTask);
        results.push(result);
        
        // Update task as completed
        await this.persistence.updateTask(taskId, {
          status: 'completed',
          result: JSON.stringify(result),
          endTime: Date.now(),
        });
        
        console.log(`  ✅ Stage complete`);
      } catch (error) {
        console.error(`  ❌ Stage failed: ${error}`);
        
        // Update task as failed
        await this.persistence.updateTask(taskId, {
          status: 'failed',
          error: String(error),
          endTime: Date.now(),
        });
        
        // Update pipeline as failed
        await this.persistence.updatePipeline(pipelineId, {
          status: 'failed',
        });
        
        // Analyze failure
        await this.analyzeFailure(stageTask, error);
        
        return {
          success: false,
          error: String(error),
          logs: results.map(r => r.logs || []).flat(),
        };
      }
    }
    
    // Mark pipeline as completed
    await this.persistence.updatePipeline(pipelineId, {
      status: 'completed',
      currentStage: 'done',
    });
    
    console.log('\n✅ Pipeline complete!');
    
    return {
      success: true,
      data: { 
        pipelineId,
        stages: results 
      },
      logs: results.map(r => r.logs || []).flat(),
    };
  }
  
  private async runGate(gate: any, task: TaskConfig): Promise<boolean> {
    for (const check of (gate.checks || [])) {
      const passed = await check.validator(task);
      if (!passed) return false;
    }
    return true;
  }
  
  private async analyzeFailure(task: TaskConfig, error: any): Promise<void> {
    try {
      const improver = this.router.getAgent('Improver');
      await improver.execute({
        id: `analyze_${Date.now()}`,
        type: 'analyze-failure',
        description: 'Analyze failure for patterns',
        data: { task, error },
      });
    } catch (e) {
      console.error('Failed to analyze failure:', e);
    }
  }
  
  async getStatus(): Promise<any> {
    const running = await this.persistence.getRunningPipelines();
    const recentFailed = await this.persistence.getFailedTasks(Date.now() - 24 * 60 * 60 * 1000);
    
    return {
      runningPipelines: running.length,
      recentFailures: recentFailed.length,
      routerStatus: await this.router.getStatus(),
    };
  }
  
  async getPipelineDetails(pipelineId: string): Promise<any> {
    const pipeline = await this.persistence.getPipeline(pipelineId);
    if (!pipeline) return null;
    
    const tasks = await this.persistence.getPipelineTasks(pipelineId);
    
    return {
      ...pipeline,
      tasks,
    };
  }
}

// Re-exports
export { Router, ProjectLead, ResearchLead, Improver };
export * from './agents/types';
export * from './persistence';