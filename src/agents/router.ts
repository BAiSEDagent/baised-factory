import { Agent } from './types';

/**
 * Router Agent
 * Communication hub and task routing
 */
export class Router {
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, TaskStatus> = new Map();
  
  register(name: string, agent: Agent): void {
    this.agents.set(name, agent);
  }
  
  getAgent(name: string): Agent {
    const agent = this.agents.get(name);
    if (!agent) throw new Error(`Agent ${name} not found`);
    return agent;
  }
  
  async route(task: Task): Promise<Result> {
    // Select best agent for task
    const agentName = this.selectAgent(task);
    const agent = this.getAgent(agentName);
    
    // Track task
    this.tasks.set(task.id, {
      agent: agentName,
      status: 'running',
      startTime: Date.now(),
    });
    
    try {
      const result = await agent.execute(task);
      
      this.tasks.set(task.id, {
        ...this.tasks.get(task.id)!,
        status: 'completed',
        endTime: Date.now(),
      });
      
      return result;
    } catch (error) {
      this.tasks.set(task.id, {
        ...this.tasks.get(task.id)!,
        status: 'failed',
        error: String(error),
        endTime: Date.now(),
      });
      
      // Escalate to human if critical
      if (task.critical) {
        await this.escalate(task, error);
      }
      
      throw error;
    }
  }
  
  private selectAgent(task: Task): string {
    // Simple routing logic
    if (task.type === 'research') return 'ResearchLead';
    if (task.type === 'planning') return 'ProjectLead';
    if (task.type === 'implementation') return 'Implementer';
    if (task.type === 'improvement') return 'Improver';
    
    // Default to ProjectLead
    return 'ProjectLead';
  }
  
  private async escalate(task: Task, error: any): Promise<void> {
    console.error(`🚨 ESCALATION: Task ${task.id} failed`);
    console.error(`Agent: ${this.tasks.get(task.id)?.agent}`);
    console.error(`Error: ${error}`);
    
    // Notify human operator
    await this.notifyHuman({
      type: 'escalation',
      task,
      error,
      timestamp: Date.now(),
    });
  }
  
  async getStatus(): Promise<SystemStatus> {
    return {
      agents: Array.from(this.agents.keys()),
      running: Array.from(this.tasks.entries())
        .filter(([_, t]) => t.status === 'running'),
      completed: Array.from(this.tasks.entries())
        .filter(([_, t]) => t.status === 'completed'),
      failed: Array.from(this.tasks.entries())
        .filter(([_, t]) => t.status === 'failed'),
    };
  }
  
  private async notifyHuman(notification: any): Promise<void> {
    // Send to Telegram, email, or other channel
    console.log('Notification sent to operator:', notification);
  }
}

interface Task {
  id: string;
  type: string;
  description: string;
  critical: boolean;
  data: any;
}

interface Result {
  success: boolean;
  data: any;
  logs: string[];
}

interface TaskStatus {
  agent: string;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  error?: string;
}

interface SystemStatus {
  agents: string[];
  running: [string, TaskStatus][];
  completed: [string, TaskStatus][];
  failed: [string, TaskStatus][];
}