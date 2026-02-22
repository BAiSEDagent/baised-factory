# BMAD Factory

**4-agent pipeline for autonomous software development.**

Based on kellyclaudeai/bmad-factory patterns.

## Overview

BMAD Factory orchestrates 4 specialized agents:
1. **Project Lead** — Direction, planning, quality gates
2. **Research Lead** — Information gathering, best practices  
3. **Router** — Communication, task routing, monitoring
4. **Improver** — Self-improvement, pattern recognition

## Quick Start

```typescript
import { BMADFactory } from '@baised/bmad-factory';

const factory = new BMADFactory();
await factory.initialize();

const result = await factory.execute({
  type: 'feature',
  description: 'Add user authentication',
  requirements: ['OAuth2', 'JWT', 'session management']
});
```

## Pipeline Stages

```
Requirements → Research → Plan → Implement → Test → Ship
      ↑________↓________↓_________↓________↓
        (feedback loops for fixes)
```

## Quality Gates

Each stage has checkpoints:
- Requirements: Clear success criteria?
- Plan: Tasks <2 hours? Dependencies identified?
- Implement: Code follows style? Tests pass?
- Test: QA complete? Edge cases handled?
- Ship: Deployed? Monitoring? Users notified?

## Source of Truth

- `/core/workflows.md` — Pipeline definitions
- `/core/quality-gates.md` — Gate checklists  
- `/changelog/` — Daily improvements
- AGENTS.md — Auto-synced from /core/

## License

MIT
