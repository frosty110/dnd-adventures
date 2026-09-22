---
name: bedrock-runtime-operator
description: Implement and maintain AWS Bedrock runtime integration for this demo. Use when changing model invocation, timeout and cancellation behavior, streaming response handling, or prompt assembly.
---

# Bedrock Runtime Operator

Use this workflow for Bedrock request/response and prompt execution changes.

## Load context

1. Read `CLAUDE.md` for architecture and reliability constraints.
2. Read `.planning/ROADMAP.md` and active phase plan for required behavior.
3. Read `.planning/research/ARCHITECTURE.md` for the expected chat pipeline.

## Non-negotiables

1. Use `@aws-sdk/client-bedrock-runtime`.
2. Keep server as source of truth for conversation state.
3. Keep SSE chat streaming behavior compatible with current client parsing.
4. Keep Datadog trace bootstrap and Bedrock trace env wiring intact.

## Runtime conventions

1. Wrap Bedrock calls with explicit timeout and cancellation handling.
2. Return clear recoverable error payloads over stream before completion.
3. Keep fallback responses deterministic enough for demo continuity.
4. Treat model settings as config-driven and easy to inspect.

## Prompt assembly conventions

1. Inject only compact lore context needed for the current turn.
2. Keep prompt sections structured and consistent across turns.
3. Keep narration and gameplay prompts separate by intent.

## Verification checklist

1. Run `yarn tsc --noEmit -p server` after server-side changes.
2. Run `yarn dev` and execute the scripted 3-turn flow.
3. Confirm timeout and cancellation paths are observable and non-crashing.
