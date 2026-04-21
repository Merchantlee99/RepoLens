# Design-Options.md — RepoLens MVP

## Option A

- Approach: AI-first repo explanation product from day one
- Pros: more natural language output, higher perceived intelligence, easier marketing story
- Cons: slower, less deterministic, more expensive, higher hallucination risk in core analysis

## Option B

- Approach: static-analysis-first MVP with template-based explanation and beginner-oriented UI
- Pros: reproducible facts, lower cost, faster execution, cleaner debugging, stronger trust foundation
- Cons: less expressive language, more rule-writing needed, weaker handling of ambiguous repos

## Decision

- Chosen option: B
- Why: RepoLens의 1단계 목표는 “AI처럼 말하는 도구”가 아니라 “레포를 신뢰 가능하게 이해시키는 도구”이기 때문이다. 분석의 중심은 사실 기반이어야 하고, AI는 이후 설명 보강 계층으로 추가하는 편이 맞다.
