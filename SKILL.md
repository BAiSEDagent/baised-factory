# BMAD Factory v1.2.0

**One-shot shipping with worktree isolation and PM merge.**

## What's New in v1.2.0

### Core Primitives for Reliable Parallelism

| Feature | v1.1 | v1.2 |
|---------|------|------|
| **Agent Isolation** | Shared working directory | **Git worktrees** |
| **Conflict Detection** | None | **File-level conflict detection** |
| **Merge Strategy** | Naive git merge | **PM review + strict merge** |
| **Parallel Execution** | Sequential | **Parallel department agents** |
| **Output Protocol** | Unstructured | **ArtifactManifest** |

## The One-Shot Model

```
┌─────────────────────────────────────────────────────────┐
│  PROJECT LEAD (single brain)                             │
│  └── Breaks down requirements into subtasks              │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
   │ Frontend│  │ Backend │  │   QA    │
   │  Agent  │  │  Agent  │  │  Agent  │
   │ (work-  │  │ (work-  │  │ (work-  │
   │  tree)  │  │  tree)  │  │  tree)  │
   └────┬────┘  └────┬────┘  └────┬────┘
        │            │            │
        └────────────┼────────────┘
                     │
              ┌──────▼──────┐
              │ PM REVIEW   │
              │ - Conflicts?│
              │ - Tests pass?│
              │ - Risk flags?│
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │ PM MERGE    │
              │ (strict)    │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │   main      │
              │  branch     │
              └─────────────┘
```

## Quick Start

```typescript
import { BMADFactory } from '@baised/bmad-factory';

const factory = new BMADFactory('/tmp/my-worktrees');
await factory.initialize();

// One-shot build with parallel departments
const result = await factory.execute(
  {
    id: 'feature-auth',
    description: 'Add authentication system',
    data: {
      requirements: ['OAuth2', 'JWT', 'Protected routes']
    }
  },
  {
    parallel: true,
    agents: ['Frontend', 'Backend', 'QA']
  }
);

console.log(result.commitHash); // Merged commit
console.log(result.manifests);  // Each agent's output
```

## Worktree Isolation

Each agent gets its own git worktree:

```typescript
// Spawn worktree for agent
const worktree = worktreeManager.spawn('feat-auth-frontend', 'main');
// Creates: /tmp/my-worktrees/feat-auth-frontend
// Branch: feat-auth-frontend (from main)

// Agent works in isolation
// Changes don't affect other agents until merge

// Cleanup when done
worktreeManager.cleanup('feat-auth-frontend');
```

## Artifact Manifest Protocol

Every agent must output:

```typescript
interface ArtifactManifest {
  agent: string;           // "Frontend"
  worktree: string;        // "feat-auth-frontend"
  summary: string;         // "Add login page + auth form"
  filesChanged: string[];  // ["apps/web/pages/login.tsx"]
  commandsRun: string[];   // ["pnpm test", "pnpm lint"]
  testStatus: 'pass' | 'fail' | 'skipped';
  notes: string[];         // ["Known issue: mobile layout"]
  riskFlags: ('touches-auth' | 'db-migration' | 'breaking-change')[];
  timestamp: number;
}
```

## PM Review Gate

Before merge, PM checks:

```typescript
const review = pm.review(manifests);

review.conflicts    // File-level conflicts between agents
review.errors       // Test failures, validation errors
review.warnings     // Risk flags, missing tests
review.riskAssessment.level  // 'low' | 'medium' | 'high' | 'critical'

if (!review.approved) {
  // Merge blocked - fix conflicts first
}
```

**Strict mode (default):** Any conflict = rejection

## PM Merge Strategy

```typescript
const result = pm.merge(worktrees, manifests, 'main');

if (result.success) {
  console.log('Merged:', result.commitHash);
} else {
  console.error('Merge failed:', result.error);
  // Worktrees preserved for debugging
}
```

**Merge order:** API → Backend → Frontend → QA → Docs

**On conflict:** Hard fail, no auto-resolution

## Conflict Detection

```typescript
const conflicts = detectConflicts([
  frontendManifest,  // touched: apps/web/login.tsx
  backendManifest,   // touched: apps/api/auth.ts
]);

// No conflicts - different files
// conflicts = []

const conflicts = detectConflicts([
  frontendManifest,  // touched: shared/types.ts
  backendManifest,   // touched: shared/types.ts
]);

// CONFLICT!
// conflicts = ['CONFLICT: shared/types.ts touched by both Frontend and Backend']
```

## Parallel vs Sequential

```typescript
// Sequential (default) - predictable, slower
await factory.execute(task, { parallel: false });

// Parallel - faster, needs conflict-free design
await factory.execute(task, { 
  parallel: true,
  agents: ['Frontend', 'Backend', 'QA']
});
```

## Risk Flags

```typescript
// Agent declares risk flags in manifest
const manifest = createManifest(
  'Backend',
  'feat-auth-api',
  'Add JWT middleware',
  ['apps/api/middleware/auth.ts'],
  {
    riskFlags: ['touches-auth', 'breaking-change'],
    testStatus: 'pass'
  }
);

// PM escalates to critical
review.riskAssessment.level === 'critical'
// Requires manual review before merge
```

## Failure Isolation

When one agent fails, others are preserved:

```
Frontend: ✅ PASS
Backend:  ❌ FAIL (auth token issue)
QA:       ⏸️  SKIPPED (Backend failed)

Result: 
- Frontend worktree kept for inspection
- Backend error logged
- No partial merge to main
- Clean rollback possible
```

## Directory Structure

```
/tmp/bmad-worktrees/
├── feat-auth-frontend/     # Frontend agent worktree
├── feat-auth-backend/      # Backend agent worktree
├── feat-auth-qa/           # QA agent worktree
└── ...
```

## API Reference

### WorktreeManager

```typescript
const manager = new WorktreeManager('/tmp/worktrees');

// Spawn
const wt = manager.spawn('feature-x', 'main');
// Returns: { path, branch, baseRef, createdAt }

// List
const all = manager.list();

// Cleanup
manager.cleanup('feature-x');
manager.cleanupAll();
```

### ProjectManager

```typescript
const pm = new ProjectManager();

// Review
const review = pm.review(manifests);
// Returns: { approved, conflicts, errors, warnings, riskAssessment }

// Merge
const result = pm.merge(worktrees, manifests, 'main');
// Returns: { success, commitHash?, error? }

// Strict mode
pm.setStrictMode(false); // Allow conflicts (not recommended)
```

### BMADFactory.execute()

```typescript
const result = await factory.execute(
  taskConfig,           // Task description + data
  {
    pipeline?,          // Custom pipeline (optional)
    parallel?: boolean,  // Run agents in parallel
    agents?: string[]    // Department agents to spawn
  }
);

// Returns:
{
  pipelineId: string;
  worktrees: string[];
  commitHash?: string;
  manifests: ArtifactManifest[];
  success: boolean;
  error?: string;
}
```

## Migration from v1.1

```typescript
// v1.1 - Shared working directory
const factory = new BMADFactory();
await factory.initialize();

// v1.2 - Worktree isolation
const factory = new BMADFactory('/tmp/worktrees');
await factory.initialize();

// Execute now spawns worktrees automatically
const result = await factory.execute(task, {
  parallel: true,  // NEW: parallel execution
  agents: ['Frontend', 'Backend']
});
```

## Best Practices

1. **Always use worktrees** - Never run agents in shared directory
2. **Declare all file changes** - Undeclared changes = merge surprise
3. **Fail tests = block merge** - No exceptions
4. **Risk flags are mandatory** - Auth, DB, security must be flagged
5. **Clean up worktrees** - Preserve disk space
6. **Parallel needs isolation** - Design for conflict-free parallel work

## Troubleshooting

**"Worktree already exists"**
```bash
# Cleanup manually
git worktree remove /tmp/worktrees/NAME --force
git branch -D NAME
```

**"Merge conflict"**
```typescript
// PM review will show conflicts
const review = pm.review(manifests);
console.log(review.conflicts);

// Fix: Redesign agents to touch different files
// Or: Run sequentially instead of parallel
```

**"Agent failed but others kept running"**
```typescript
// Check which failed
const failed = result.manifests.filter(m => m.testStatus === 'fail');

// Inspect worktree
const wt = worktreeManager.get(failed[0].worktree);
// Check files at wt.path
```

## Architecture

```
BMADFactory v1.2
├── WorktreeManager
│   ├── spawn()     // git worktree add
│   ├── cleanup()   // git worktree remove
│   └── list()      // Active worktrees
├── Router
│   └── Agents execute in worktrees
├── PM (ProjectManager)
│   ├── review()    // Conflict detection
│   └── merge()     // Strict merge to main
└── Persistence
    └── Pipeline/task history
```

## License

MIT

## Credits

Based on Codex worktree architecture  
Inspired by kellyclaudeai/bmad-factory  
Built for one-shot product shipping