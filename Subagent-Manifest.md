# Subagent-Manifest.md — RepoLens MVP

## Roles

### Orchestrator

- Who: main Codex session
- Goal: keep product scope, analysis architecture, and integration aligned
- Mode: local
- Write scope: root docs and final integration across the repo

### Explorer

- Who: future bounded codebase or docs explorers
- Goal: answer narrow questions such as GitHub API shape, Next.js analyzer constraints, or result schema concerns
- Read scope: repository-wide plus cited external docs when needed
- Write scope: none
- Stop condition: return a bounded answer with references

### Worker

- Who: future implementation subagents
- Goal: own disjoint slices such as analyzer, UI shell, or data schema modules
- Mode: worktree
- Write scope: assigned-only
- Read scope: assigned context plus shared docs
- Stop condition: complete the bounded slice and report changed paths

### Reviewer

- Who: future independent reviewer
- Goal: verify regressions, schema correctness, UI clarity, and validation coverage
- Write scope: `.codex/reviews/**`
- Stop condition: produce a review artifact with verdict and validation notes

## Boundaries

- Root product docs are owned by the orchestrator.
- Analyzer and UI write scopes should not overlap in parallel work.
- Reviewer should not patch the same production scope they review.
- Real subagent dispatch should be pre-structured with `python3 scripts/harness/subagent_planner.py plan ...`.

## Escalation

- If analysis scope drifts beyond MVP: update `PRD.md` and `Plan.md` first.
- If stack support needs expansion: document the new support contract before implementation.
