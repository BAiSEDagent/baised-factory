import { Agent } from './types';

/**
 * Research Lead Agent
 * 5-phase information gathering pipeline
 */
export const ResearchLead: Agent = {
  name: 'ResearchLead',
  
  async discover(query: string): Promise<Discovery[]> {
    // Phase 1: Find existing solutions
    const findings: Discovery[] = [];
    
    // Search GitHub, npm, docs
    findings.push(...await this.searchGitHub(query));
    findings.push(...await this.searchNPM(query));
    findings.push(...await this.searchDocs(query));
    
    return findings;
  },
  
  async analyze(findings: Discovery[]): Promise<Analysis[]> {
    // Phase 2: Evaluate tradeoffs
    return findings.map(f => ({
      source: f.source,
      pros: this.extractPros(f),
      cons: this.extractCons(f),
      complexity: this.estimateComplexity(f),
      maintenance: this.estimateMaintenance(f),
    }));
  },
  
  async synthesize(analyses: Analysis[]): Promise<Recommendation> {
    // Phase 3: Combine best approaches
    const best = this.selectBest(analyses);
    
    return {
      approach: best.name,
      rationale: this.explainChoice(best, analyses),
      alternatives: analyses.filter(a => a !== best).slice(0, 2),
    };
  },
  
  async document(recommendation: Recommendation): Promise<void> {
    // Phase 4: Write to /research/
    await this.writeFile(
      `/research/${Date.now()}-${recommendation.approach}.md`,
      this.formatResearch(recommendation)
    );
  },
  
  async recommend(query: string): Promise<Recommendation> {
    // Phase 5: Full pipeline
    const findings = await this.discover(query);
    const analyses = await this.analyze(findings);
    const recommendation = await this.synthesize(analyses);
    await this.document(recommendation);
    return recommendation;
  }
};

interface Discovery {
  source: string;
  url: string;
  summary: string;
  relevance: number;
}

interface Analysis {
  source: string;
  pros: string[];
  cons: string[];
  complexity: 'low' | 'medium' | 'high';
  maintenance: 'low' | 'medium' | 'high';
}

interface Recommendation {
  approach: string;
  rationale: string;
  alternatives: Analysis[];
}