# Prompt.md — RepoLens MVP

## Goal

Build the first usable MVP of RepoLens: a web app that turns a public GitHub repository or owner profile into a beginner-friendly understanding workspace.

## Non-Goals

- Private repository support
- Monorepo-first support
- Commit history explanation
- LLM-dependent analysis pipeline
- Precise behavioral flow extraction across arbitrary stacks

## Constraints

- Public GitHub repositories and public GitHub owner profiles only
- MVP must work without AI
- Analysis must be fact-first and reproducible
- UI should optimize for beginner understanding, not developer power-user density
- Primary operator-facing docs remain in Korean

## Done-When

- [ ] A user can submit a public GitHub repo URL
- [ ] A user can also submit a public GitHub owner URL without switching modes
- [ ] The app analyzes the repository at a fixed commit SHA
- [ ] Owner-level input produces a portfolio understanding screen with repo drill-down links
- [ ] The result workspace renders Overview, Architecture, Key Files, and Edit Guide Lite
- [ ] The Result workspace uses a sectioned left panel for view/layer/scope/status instead of top tabs
- [ ] The Result summary is compressed into a strip so the canvas/understanding frame dominates the screen
- [ ] The analysis pipeline is primarily rule-based and deterministic
- [ ] The first supported stack path is documented and testable

## Open Questions

- Should first-pass analysis use downloaded archives only, or support both archives and tree APIs?
- What repo size limits should trigger a reduced-analysis mode?
