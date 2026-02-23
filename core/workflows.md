# BAiSED Factory Factory - Core Workflows

Based on kellyclaudeai/baised-factory-factory patterns.

## 4-Agent Pipeline

### 1. Project Lead
**Responsibility:** Overall direction, task breakdown, quality gates

**4 Modes:**
- `plan` — Break down requirements into tasks
- `implement` — Assign to Implementer, monitor progress
- `test` — Verify output meets requirements
- `ship` — Deploy, announce, document

**Quality Gates:**
- [ ] Requirements clear and complete?
- [ ] Task breakdown has <2 hour chunks?
- [ ] Tests defined before implementation?
- [ ] Documentation required?

### 2. Research Lead
**Responsibility:** Information gathering, best practices, precedents

**5-Phase Pipeline:**
1. **Discover** — Find existing solutions, libraries, patterns
2. **Analyze** — Evaluate tradeoffs, performance, maintenance
3. **Synthesize** — Combine best approaches
4. **Document** — Write findings to /research/
5. **Recommend** — Suggest implementation path

### 3. Router
**Responsibility:** Communication, monitoring, task routing

**Duties:**
- Route tasks to appropriate agent
- Monitor agent status and progress
- Escalate blockers to human
- Aggregate reports for status updates

### 4. Improver
**Responsibility:** Self-improvement, pattern recognition

**Functions:**
- Analyze failed tasks for patterns
- Update AGENTS.md with lessons learned
- Propose workflow improvements
- Consolidate duplicate patterns

## Quality Gates

Every task passes through:

```
REQUIREMENTS → PLAN → IMPLEMENT → TEST → SHIP
     ↑________↓________↓_________↓________↓
   (feedback loops for fixes)
```

### Gate 1: Requirements
- Clear success criteria defined?
- Constraints documented?
- Time estimate provided?

### Gate 2: Plan
- Task breakdown <2 hours each?
- Dependencies identified?
- Risks documented?

### Gate 3: Implement
- Code follows style guide?
- Tests pass?
- Documentation written?

### Gate 4: Test
- Manual QA completed?
- Edge cases handled?
- Performance acceptable?

### Gate 5: Ship
- Deployed to production?
- Monitoring in place?
- User notified?

## Source of Truth

### /core/
- `workflows.md` — This file
- `quality-gates.md` — Gate checklists
- `agent-roles.md` — Detailed agent responsibilities
- `patterns.md` — Common solutions and anti-patterns

### /changelog/
- `YYYY-MM-DD.md` — Daily improvements and learnings
- `workflow-changes.md` — Changes to core workflows

### Downstream Sync
AGENTS.md in workspace is auto-generated from /core/