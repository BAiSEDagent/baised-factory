/**
 * BMAD Factory - Main Orchestrator
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
import { Pipeline, Task, Result } from './agents/types';

export class BMADFactory {
  private router: Router;
  private initialized: boolean = false;
  
  // Default pipeline: Plan → Research → Implement → Test → Ship
  private defaultPipeline: Pipeline = {
    name: 'standard',
    stages: [
      { name: 'requirements', agent: 'ProjectLead', gates: [] },
      { name: 'research', agent: 'ResearchLead', gates: [] },
      { name: 'plan', agent: 'ProjectLead', gates: [] },
      { name: 'implement', agent: 'Implementer', gates: [] },
      { name: 'test', agent: 'ProjectLead', gates: [] },
      { name: 'ship', agent: 'ProjectLead', gates: [] },
    ]
  };
  
  constructor() {
    this.router = new Router();
  }
  
  async initialize(): Promise<void> {
    // Register all agents
    this.router.register('ProjectLead', ProjectLead);
    this.router.register('ResearchLead', ResearchLead);
    this.router.register('Improver', Improver);
    // Implementer would be a generic execution agent
    
    this.initialized = true;
    console.log('✅ BMAD Factory initialized');
  }
  
  async execute(task: Task, pipeline?: Pipeline): Promise<Result> {
    if (!this.initialized) {
      throw new Error('BMADFactory not initialized. Call initialize() first.');
    }
    
    const p = pipeline || this.defaultPipeline;
    const results: Result[] = [];
    
    console.log(`🚀 Starting pipeline: ${p.name}`);
    console.log(`📋 Task: ${task.description}`);
    
    for (const stage of p.stages) {
      console.log(`\n📍 Stage: ${stage.name} (${stage.agent})`);
      
      const stageTask: Task = {
        ...task,
        id: `${task.id}_${stage.name}`,
        type: stage.name,
      };
      
      try {
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
        
        console.log(`  ✅ Stage complete`);
      } catch (error) {
        console.error(`  ❌ Stage failed: ${error}`);
        
        // Send to Improver for analysis
        await this.analyzeFailure(stageTask, error);
        
        return {
          success: false,
          error: String(error),
          logs: results.map(r => r.logs || []).flat(),
        };
      }
    }
    
    console.log('\n✅ Pipeline complete!');
    
    return {
      success: true,
      data: { stages: results },
      logs: results.map(r => r.logs || []).flat(),
    };
  }
  
  private async runGate(gate: any, task: Task): Promise<boolean> {
    for (const check of gate.checks || []) {
      const passed = await check.validator(task);
      if (!passed) return false;
    }
    return true;
  }
  
  private async analyzeFailure(task: Task, error: any): Promise<void> {
    const improver = this.router.getAgent('Improver');
    // Log failure for pattern analysis
    console.log('Sending to Improver for analysis...');
  }
  
  async getStatus(): Promise<any> {
    return this.router.getStatus();
  }
}

// Re-exports
export { Router, ProjectLead, ResearchLead, Improver };
export * from './agents/types';