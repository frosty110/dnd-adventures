---
name: datadog-llmobs-operator
description: Configure and validate Datadog LLM Observability for the hackathon stack. Use when wiring dd-trace bootstrap, Bedrock trace coverage, prompt tracking, and turn-level observability checks.
---

# Datadog LLMObs Operator

Use this workflow when implementing or verifying LLM observability coverage.

## Load context

1. Read `CLAUDE.md` for required Datadog and architecture contracts.
2. Read `.planning/research/ARCHITECTURE.md` for expected chat and RAG call flow.
3. Read `.planning/STATE.md` for known observability gaps.

## Required config invariants

1. Keep server bootstrap: `NODE_OPTIONS='--import dd-trace/initialize.mjs'`.
2. Keep `DD_LLMOBS_ENABLED=1`.
3. Keep `DD_TRACE_AWS_SDK_BEDROCKRUNTIME_ENABLED=true`.
4. Keep canonical Datadog keys in env docs and startup checks.

## Instrumentation conventions

1. Keep `service` names stable across logs, traces, and dashboards.
2. Track the full turn path: request receive -> lore retrieval -> Bedrock call -> SSE stream completion.
3. Add explicit error classification tags for recoverable vs terminal failures.
4. Capture prompt/input metadata safely and avoid logging secrets.

## Prompt and turn tracking

1. Use consistent span/resource naming for chat generation and narration.
2. Include conversation correlation metadata where needed for debugging.
3. Keep prompt variants versioned in a consistent, readable format.

## Verification checklist

1. Start stack with `yarn dev`.
2. Execute the 3-turn demo flow end-to-end.
3. Confirm traces show Bedrock spans and parent/child relationships.
4. Confirm recoverable failures still produce observable error signals.
