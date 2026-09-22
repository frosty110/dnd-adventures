# AI Assistant Context (Claude, Codex, Kiro)

This is a Yarn only package - do not use npm.

## Operating Mode

This is a community product.

- Execute plans efficiently, but flag genuine reliability or scalability concerns.
- This product is targeting a scale of 10-100 concurrent users
- Write production-quality code: proper error handling, input validation, and graceful degradation.
- Don't over-engineer for 100K+ scale, but do build for real concurrent usage.
- Cosmetic warnings (dd-trace noise, deprecation notices) are not problems. Ignore them.

## Project Snapshot

- Name: D&D Adventures
- Goal: A community-facing D&D Adventures game supporting ~100 concurrent players with full Datadog LLM observability.
- Stack: React frontend, Node.js/Express backend, AWS Bedrock (Claude), Neo4j, Datadog, MiniMax TTS.

## Current Scope

- Web-based single-player D&D experience for small communities (~1000 users).
- Open-ended gameplay (not limited to scripted turns).
- Opening monologue uses TTS; turn-by-turn gameplay is text-streamed.
- Users can play full adventures with persistent conversation sessions.

## Architecture Contracts (Do Not Drift)

- Server is source of truth for conversation state.
  - Client sends: `{ conversationId?, message }` (and optional dice data when implemented).
  - Server creates and persists conversation history by `conversationId`.
- Chat transport uses `fetch` POST + `ReadableStream` SSE parsing on the client.
- `/narrate` returns `audio/wav` generated from MiniMax PCM response.
- RAG is lightweight and fast:
  - Extract entities from latest user turn only.
  - Query Neo4j for relevant lore.
  - Inject compact lore context into prompt.
- Datadog tracing uses pre-init bootstrap:
  - `NODE_OPTIONS='--import dd-trace/initialize.mjs'`
  - `DD_LLMOBS_ENABLED=1`
  - `DD_TRACE_AWS_SDK_BEDROCKRUNTIME_ENABLED=true`

## Reliability Requirements

- Bedrock calls must have timeout/cancellation handling.
- Neo4j failures must degrade gracefully (continue chat without lore).
- TTS failures must not block core chat experience.
- SSE streams should emit clear error payloads before completion when recoverable.

## Security Posture

- Authentication required for production deployment.
- Strict CORS allowlist for allowed origins.
- Body size limits on all endpoints.
- Rate limiting on `/chat` and `/narrate` (per-user, not just per-IP).
- Keep all secrets server-side only.
- Prompt hardening and input sanitization on user messages.

## Team Workflow

- Prefer the roadmap/planning flow under `.planning/`.
- Keep changes small and shippable.
- Update relevant planning docs when architecture or scope decisions change.
- Prioritize reliability and user experience at scale.

## Key References in Repo

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/research/ARCHITECTURE.md`

## Project Skill Files

- `skills/datadog-dashboard-operator/SKILL.md` for Datadog dashboards and monitor conventions.
- `skills/datadog-llmobs-operator/SKILL.md` for Datadog LLM observability setup and validation.
- `skills/bedrock-runtime-operator/SKILL.md` for Bedrock runtime integration and streaming reliability.
- `skills/neo4j-rag-operator/SKILL.md` for Neo4j retrieval conventions and graceful degradation.
