# BAiSED Factory Changelog

## v1.3.0 — Reliability Primitives

### Added
- **Preflight Gate** — Hard fail on dirty repo, missing baseRef, non-git repository
- **Ownership Map** — Conflict prevention by design, Router-enforced before spawning worktrees
- **Commit Contract** — Agents must commit, PM merges commits (not dirty trees), atomic merge

### Changed
- Merge strategy: cherry-pick → `git merge --no-ff --no-edit` (preserves merge history)
- Added `enforceOwnershipOrThrow()` helper for cleaner Router code
- Default ownership config for typical monorepo structure

### Defaults (Master Builder Mode)
- `parallel=true` only if ownership check passes
- `strict=true` always
- `atomic=true` always  
- `allowDirty=false` always
- `lockfileOwner="Backend"`

## v1.2.0 — Worktree Isolation

### Added
- WorktreeManager for isolated git worktrees per agent
- ArtifactManifest protocol for structured agent output
- ProjectManager review + merge with strict no-conflict rule
- Parallel department agent execution

## v1.1.0 — LLM + Persistence

### Added
- LLM-powered ProjectLead and ResearchLead agents
- SQLite persistence for crash recovery
- Structured LLM output with JSON schema

## v1.0.0 — Initial Release

### Added
- Basic 4-agent pipeline structure
- Router for task routing
- Quality gates framework