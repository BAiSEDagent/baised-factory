import { Agent } from './types';

/**
 * Improver Agent
 * Self-improvement through pattern recognition
 */
export const Improver: Agent = {
  name: 'Improver',
  
  async analyzeFailures(tasks: FailedTask[]): Promise<Pattern[]> {
    // Look for patterns in failures
    const patterns: Pattern[] = [];
    
    // Group by error type
    const byError = this.groupBy(tasks, 'errorType');
    
    for (const [errorType, group] of Object.entries(byError)) {
      if (group.length >= 3) {
        patterns.push({
          type: 'failure-pattern',
          name: errorType,
          frequency: group.length,
          examples: group.map(t => t.id),
          recommendation: this.suggestFix(errorType, group),
        });
      }
    }
    
    return patterns;
  },
  
  async updateAgentsMd(patterns: Pattern[]): Promise<void> {
    // Update AGENTS.md with lessons learned
    const changelog = patterns.map(p => 
      `- **${p.name}**: ${p.frequency} occurrences. ${p.recommendation}`
    ).join('\n');
    
    await this.appendToFile(
      '/changelog/lessons-learned.md',
      `\n## ${new Date().toISOString().split('T')[0]}\n${changelog}\n`
    );
  },
  
  async proposeWorkflowImprovement(): Promise<Proposal[]> {
    // Analyze current workflow efficiency
    const proposals: Proposal[] = [];
    
    // Check for bottlenecks
    const avgTaskTime = await this.calculateAverageTaskTime();
    if (avgTaskTime > 3600000) { // > 1 hour
      proposals.push({
        type: 'workflow',
        description: 'Tasks taking too long, suggest smaller breakdowns',
        priority: 'high',
      });
    }
    
    // Check for duplicate work
    const duplicates = await this.findDuplicatePatterns();
    if (duplicates.length > 0) {
      proposals.push({
        type: 'consolidation',
        description: `Found ${duplicates.length} duplicate patterns to consolidate`,
        priority: 'medium',
      });
    }
    
    return proposals;
  },
  
  async consolidatePatterns(): Promise<number> {
    // Find and merge duplicate patterns
    const patterns = await this.findDuplicatePatterns();
    let consolidated = 0;
    
    for (const group of patterns) {
      await this.mergePatterns(group);
      consolidated++;
    }
    
    return consolidated;
  },
  
  // Helpers
  groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((acc, item) => {
      const k = String(item[key]);
      acc[k] = acc[k] || [];
      acc[k].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  },
  
  suggestFix(errorType: string, examples: FailedTask[]): string {
    // Pattern-specific fixes
    const fixes: Record<string, string> = {
      'timeout': 'Increase timeout or add retry logic',
      'auth-failed': 'Check credentials and refresh tokens',
      'not-found': 'Verify file paths and dependencies',
      'syntax-error': 'Add pre-commit linting',
    };
    
    return fixes[errorType] || 'Review and add error handling';
  }
};

interface FailedTask {
  id: string;
  errorType: string;
  error: string;
  timestamp: number;
}

interface Pattern {
  type: string;
  name: string;
  frequency: number;
  examples: string[];
  recommendation: string;
}

interface Proposal {
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}