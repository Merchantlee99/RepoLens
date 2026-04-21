# Automation-Intent.md — RepoLens MVP

## Active Strategy

- 기본 상태에서는 always-on automation을 강제하지 않는다.
- 실제 구현이 시작된 뒤 장기 follow-up이 필요할 때만 heartbeat를 만든다.
- automation prompt는 작업 자체만 설명하고 스케줄 문구는 넣지 않는다.

## Candidate Loops

### Pending Review Follow-up

- kind: heartbeat
- destination: thread
- use when: 구현이 끝났지만 review artifact가 미완료일 때
- expected output: review 상태 업데이트 또는 blocker 기록

### MVP Progress Check

- kind: heartbeat
- destination: thread
- use when: analyzer 또는 UI 작업이 하루 이상 중단될 때
- expected output: 현재 milestone 상태와 다음 unblock step

### Scope Drift Audit

- kind: heartbeat
- destination: thread
- use when: 기능이 MVP 경계를 넘어가기 시작할 때
- expected output: 범위 조정안 또는 backlog 이동 제안

## Current State

- 지금 단계에서는 자동화 생성이 필수는 아니다.
- 구현이 시작되고 중단 가능성이 생기면 하나의 thread heartbeat를 고려한다.
