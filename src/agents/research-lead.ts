import { Agent, Task, Result } from './types';
import { executeLLM, executeStructuredLLM } from '../llm';

/**
 * Research Lead Agent with LLM-powered research
 */
export class ResearchLead implements Agent {
  name = 'ResearchLead';
  
  private systemPrompt = `You are a Research Lead for software development.
Your job is to find existing solutions, analyze tradeoffs, and recommend the best approach.

Rules:
1. Always cite sources
2. Compare at least 3 alternatives
3. Be specific about pros/cons
4. Include code examples where relevant`;

  async discover(query: string): Promise<Discovery[]> {
    // Use LLM to suggest what to search for
    const searchPrompt = `Given this research query, suggest 5 specific search queries to find the best solutions:

Query: ${query}

Suggest searches for:
1. Existing libraries/frameworks
2. Best practices and patterns
3. Performance benchmarks
4. Community recommendations
5. Official documentation

Return as a JSON array of search queries.`;

    const schema = `{
  "queries": ["string (search query)"]
}`;

    const response = await executeStructuredLLM<{ queries: string[] }>(
      searchPrompt,
      schema,
      { systemPrompt: this.systemPrompt }
    );

    // For now, return synthetic discoveries based on the queries
    // In production, this would actually call web search APIs
    const findings: Discovery[] = response.queries.map((q, i) => ({
      source: `search-${i + 1}`,
      query: q,
      summary: `Research needed: ${q}`,
      relevance: 0.8 - (i * 0.1),
    }));

    return findings;
  }

  async analyze(findings: Discovery[]): Promise<Analysis[]> {
    const prompt = `Analyze these research findings and provide a detailed comparison:

${JSON.stringify(findings, null, 2)}

For each finding, extract:
- Pros (3-5 bullet points)
- Cons (3-5 bullet points)
- Complexity (low/medium/high)
- Maintenance burden (low/medium/high)
- Best use case`;

    const schema = `{
  "analyses": [
    {
      "source": "string",
      "pros": ["string"],
      "cons": ["string"],
      "complexity": "low|medium|high",
      "maintenance": "low|medium|high",
      "bestUseCase": "string"
    }
  ]
}`;

    const response = await executeStructuredLLM<{ analyses: Analysis[] }>(
      prompt,
      schema,
      { systemPrompt: this.systemPrompt, temperature: 0.4 }
    );

    return response.analyses;
  }

  async synthesize(analyses: Analysis[]): Promise<Recommendation> {
    const prompt = `Based on these analyses, recommend the best approach:

${JSON.stringify(analyses, null, 2)}

Provide:
1. Best overall choice
2. Rationale (3-5 sentences)
3. When to use each alternative
4. Implementation guidance`;

    const schema = `{
  "recommendation": {
    "bestChoice": "string",
    "rationale": "string",
    "alternatives": ["string"],
    "implementation": "string"
  }
}`;

    const response = await executeStructuredLLM<{ recommendation: Recommendation }>(
      prompt,
      schema,
      { systemPrompt: this.systemPrompt, temperature: 0.3 }
    );

    return response.recommendation;
  }

  async recommend(query: string): Promise<Recommendation> {
    console.log(`[ResearchLead] Researching: ${query}`);
    
    const findings = await this.discover(query);
    console.log(`[ResearchLead] Found ${findings.length} potential solutions`);
    
    const analyses = await this.analyze(findings);
    console.log(`[ResearchLead] Analyzed ${analyses.length} options`);
    
    const recommendation = await this.synthesize(analyses);
    console.log(`[ResearchLead] Recommendation: ${recommendation.bestChoice}`);
    
    return recommendation;
  }

  // Required Agent interface method
  async execute(task: Task): Promise<Result> {
    if (task.type === 'research') {
      const recommendation = await this.recommend(task.data.query);
      return { success: true, data: recommendation };
    }
    
    return { success: false, error: `Unknown task type: ${task.type}` };
  }
}

interface Discovery {
  source: string;
  query: string;
  summary: string;
  relevance: number;
}

interface Analysis {
  source: string;
  pros: string[];
  cons: string[];
  complexity: 'low' | 'medium' | 'high';
  maintenance: 'low' | 'medium' | 'high';
  bestUseCase?: string;
}

interface Recommendation {
  bestChoice: string;
  rationale: string;
  alternatives: string[];
  implementation: string;
}