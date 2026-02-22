import { Agent } from './types';

/**
 * Project Lead Agent
 * Manages overall project direction and quality gates
 */
export const ProjectLead: Agent = {
  name: 'ProjectLead',
  
  async plan(requirements: string): Promise<Task[]> {
    // Break down requirements into <2 hour tasks
    const tasks = await this.breakDown(requirements);
    
    // Quality gate: Are tasks small enough?
    for (const task of tasks) {
      if (task.estimatedHours > 2) {
        throw new Error(`Task ${task.id} too large: ${task.estimatedHours}h`);
      }
    }
    
    return tasks;
  },
  
  async implement(task: Task): Promise<Result> {
    // Assign to Implementer agent
    const implementer = await Router.getAgent('Implementer');
    return implementer.execute(task);
  },
  
  async test(result: Result, criteria: string[]): Promise<TestReport> {
    // Verify against success criteria
    const report: TestReport = { passed: [], failed: [] };
    
    for (const criterion of criteria) {
      const passed = await this.verify(result, criterion);
      if (passed) {
        report.passed.push(criterion);
      } else {
        report.failed.push(criterion);
      }
    }
    
    return report;
  },
  
  async ship(result: Result): Promise<Deployment> {
    // Deploy and announce
    const deployment = await this.deploy(result);
    await this.announce(deployment);
    await this.document(deployment);
    return deployment;
  }
};

interface Task {
  id: string;
  description: string;
  estimatedHours: number;
  dependencies: string[];
}

interface Result {
  artifact: string;
  tests: string[];
  docs: string;
}

interface TestReport {
  passed: string[];
  failed: string[];
}

interface Deployment {
  url: string;
  version: string;
  timestamp: number;
}