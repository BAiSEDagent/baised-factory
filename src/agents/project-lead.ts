import { Agent, Task, Result } from './types';
import { executeLLM, executeStructuredLLM } from '../llm';

/**
 * Project Lead Agent with LLM-powered execution
 */
export class ProjectLead implements Agent {
  name = 'ProjectLead';
  
  private systemPrompt = `You are a Project Lead for software development.
Your job is to break down requirements into actionable tasks, verify quality, and coordinate shipping.

Rules:
1. Tasks should be <2 hours each
2. Always include success criteria
3. Identify dependencies between tasks
4. Be specific about deliverables`;

  async plan(requirements: string): Promise<SubTask[]> {
    const schema = `{
  "tasks": [
    {
      "id": "string (short lowercase with dashes)",
      "description": "string (specific, actionable)",
      "estimatedHours": "number (0.5 to 2.0)",
      "dependencies": ["string (other task IDs)"],
      "acceptanceCriteria": ["string"]
    }
  ]
}`;

    const response = await executeStructuredLLM<{ tasks: SubTask[] }>(
      `Break down this requirement into small, actionable tasks:\n\n${requirements}`,
      schema,
      { systemPrompt: this.systemPrompt, temperature: 0.3 }
    );

    // Validate: all tasks <2 hours
    for (const task of response.tasks) {
      if (task.estimatedHours > 2) {
        console.warn(`Task ${task.id} exceeds 2 hours: ${task.estimatedHours}h`);
      }
    }

    return response.tasks;
  }

  async implement(taskDescription: string): Promise<string> {
    // For implementation, we just return the plan
    // Actual implementation is done by a coding agent or human
    return `Implementation plan for: ${taskDescription}`;
  }

  async test(result: any, criteria: string[]): Promise<TestReport> {
    const schema = `{
  "passed": ["string (which criteria passed)"],
  "failed": ["string (which criteria failed)"],
  "notes": "string (explanation of results)"
}`;

    const prompt = `Verify this result meets the acceptance criteria:

Result: ${JSON.stringify(result, null, 2)}

Criteria:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

    const response = await executeStructuredLLM<{
      passed: string[];
      failed: string[];
      notes: string;
    }>(prompt, schema, { systemPrompt: this.systemPrompt, temperature: 0.2 });

    return {
      passed: response.passed,
      failed: response.failed,
      notes: response.notes,
      success: response.failed.length === 0,
    };
  }

  async ship(artifact: any): Promise<Shipment> {
    const deployment = {
      version: `v${Date.now()}`,
      timestamp: Date.now(),
      artifact: artifact,
    };

    return {
      success: true,
      deployment,
      announcement: `Shipped ${artifact.name || 'project'} at ${new Date().toISOString()}`,
    };
  }

  // Required Agent interface method
  async execute(task: Task): Promise<Result> {
    switch (task.type) {
      case 'plan':
        const tasks = await this.plan(task.data.requirements);
        return { success: true, data: tasks };
      
      case 'test':
        const report = await this.test(task.data.result, task.data.criteria);
        return { success: report.success, data: report };
      
      case 'ship':
        const shipment = await this.ship(task.data.artifact);
        return { success: shipment.success, data: shipment };
      
      default:
        return { success: false, error: `Unknown task type: ${task.type}` };
    }
  }
}

interface SubTask {
  id: string;
  description: string;
  estimatedHours: number;
  dependencies: string[];
  acceptanceCriteria: string[];
}

interface TestReport {
  passed: string[];
  failed: string[];
  notes: string;
  success: boolean;
}

interface Shipment {
  success: boolean;
  deployment: any;
  announcement: string;
}