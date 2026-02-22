# BMAD Factory v1.1.0

**4-agent LLM-powered pipeline for autonomous software development.**

Now with real LLM execution, SQLite persistence, and full observability.

## What's New in v1.1.0

- ✅ **LLM-Powered Agents** — Agents use GPT-4o-mini for actual reasoning
- ✅ **SQLite Persistence** — Resume pipelines after crashes
- ✅ **Structured Output** — JSON schema enforcement for reliable results
- ✅ **Pipeline Observability** — Query status, history, and failures
- ✅ **Real Research** — Research Lead generates actual search queries

## Quick Start

### 1. Install

```bash
npm install
npm run build
```

### 2. Configure OpenAI

```bash
export OPENAI_API_KEY="sk-..."
```

Or create `~/.baised/bmad-config.json`:
```json
{
  "openaiApiKey": "sk-..."
}
```

### 3. Run Example

```bash
npm run example
```

## Usage

```typescript
import { BMADFactory } from '@baised/bmad-factory';

const factory = new BMADFactory();
await factory.initialize();

const result = await factory.execute({
  id: 'feature-001',
  type: 'feature',
  description: 'Add user authentication',
  data: {
    requirements: ['OAuth2', 'JWT', 'session management']
  },
  critical: true,
});

console.log(result.success); // true/false
console.log(result.data.pipelineId); // pipeline_123456
```

## 4-Agent Pipeline

### 1. Project Lead
**LLM-powered planning, testing, and shipping**

```typescript
// Breaks down requirements into <2 hour tasks
const tasks = await projectLead.plan(
  "Build a user authentication system"
);
// Returns: [{ id, description, estimatedHours, dependencies, acceptanceCriteria }]

// Verifies results meet criteria
const report = await projectLead.test(result, criteria);
// Returns: { passed: [...], failed: [...], success: boolean }
```

### 2. Research Lead  
**LLM-powered research and analysis**

```typescript
// Discovers existing solutions
const recommendation = await researchLead.recommend(
  "Best authentication library for Node.js"
);
// Returns: { bestChoice, rationale, alternatives, implementation }
```

### 3. Router
**Task routing and monitoring**

- Routes tasks to appropriate agents
- Persists status to SQLite
- Escalates failures
- Tracks token usage

### 4. Improver
**Pattern recognition and self-improvement**

- Analyzes failed tasks for patterns
- Updates AGENTS.md with lessons
- Proposes workflow improvements

## Pipeline Stages

```
Requirements → Research → Plan → Implement → Test → Ship
      ↑________↓________↓_________↓________↓
        (feedback loops for fixes)
```

Each stage:
1. Creates persistent task record
2. Executes agent with LLM
3. Validates output
4. Updates database
5. Continues or fails

## Quality Gates

Every stage has checkpoints:

| Stage | Gate | Validation |
|-------|------|------------|
| Requirements | Clear criteria | Has acceptanceCriteria array |
| Plan | Task size | All tasks <2 hours |
| Implement | Style check | Passes lint |
| Test | QA complete | All criteria passed |
| Ship | Deployed | URL accessible |

## Database Schema

SQLite database at `~/.baised/bmad.db`:

```sql
-- Pipelines
pipelines: id, name, status, current_stage, created_at, updated_at

-- Tasks
tasks: id, pipeline_id, stage, agent, description, status, 
       result, error, start_time, end_time, created_at
```

Query directly:
```typescript
// Get running pipelines
const running = await persistence.getRunningPipelines();

// Get failed tasks from last 24h
const failed = await persistence.getFailedTasks(
  Date.now() - 24 * 60 * 60 * 1000
);

// Get pipeline details
const details = await factory.getPipelineDetails('pipeline_123');
```

## Observability

### Check Status
```typescript
const status = await factory.getStatus();
// {
//   runningPipelines: 2,
//   recentFailures: 0,
//   routerStatus: { agents: [...], running: [...] }
// }
```

### Query History
```typescript
const details = await factory.getPipelineDetails('pipeline_123');
// Returns full pipeline with all tasks and results
```

## Configuration

### Environment Variables
- `OPENAI_API_KEY` — Required for LLM calls
- `OPENAI_MODEL` — Model to use (default: gpt-4o-mini)

### Custom Pipeline
```typescript
const customPipeline = {
  name: 'research-only',
  stages: [
    { name: 'discover', agent: 'ResearchLead', gates: [] },
    { name: 'analyze', agent: 'ResearchLead', gates: [] },
  ]
};

await factory.execute(task, customPipeline);
```

## Architecture

```
BMADFactory
    │
    ├── ProjectLead (LLM: planning, testing, shipping)
    ├── ResearchLead (LLM: discovery, analysis, recommendation)
    ├── Router (task routing, persistence)
    └── Improver (pattern analysis)
    │
    └── Persistence (SQLite)
        ├── pipelines table
        └── tasks table
```

## Source of Truth

- `/core/workflows.md` — Pipeline definitions
- `/core/quality-gates.md` — Gate checklists  
- `/changelog/` — Daily improvements
- `AGENTS.md` — Auto-synced from /core/

## Migration from v1.0

v1.0 had stub agents. v1.1 adds:
- Real LLM calls in ProjectLead and ResearchLead
- SQLite persistence layer
- Observability methods

Update your code:
```typescript
// v1.0
const factory = new BMADFactory();
await factory.initialize(); // No persistence

// v1.1  
const factory = new BMADFactory();
await factory.initialize('~/.baised/bmad.db'); // With persistence
```

## License

MIT

## Credits

Based on kellyclaudeai/bmad-factory patterns  
Enhanced with LLM execution and persistence