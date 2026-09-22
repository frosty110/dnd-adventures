---
name: neo4j-rag-operator
description: Implement and tune Neo4j-backed lightweight RAG for the hackathon flow. Use when changing entity extraction, Cypher retrieval, lore formatting, or graceful-degradation behavior.
---

# Neo4j RAG Operator

Use this workflow when modifying retrieval logic and lore prompt injection.

## Load context

1. Read `CLAUDE.md` for RAG and reliability contracts.
2. Read `.planning/research/ARCHITECTURE.md` for current retrieval design.
3. Read `.planning/STATE.md` for known data or connectivity blockers.

## RAG constraints

1. Extract entities from the latest user turn only.
2. Keep retrieval compact and latency-aware.
3. Inject concise lore context into the prompt.
4. If Neo4j fails, continue chat without lore (no hard stop).

## Query conventions

1. Use parameterized Cypher queries.
2. Keep result sets bounded and deterministic for demo speed.
3. Prefer indexed lookups for primary entity paths.
4. Normalize lore snippets before prompt injection.

## Failure-handling conventions

1. Catch Neo4j errors at the retrieval boundary.
2. Return empty lore context on failure and continue generation.
3. Emit observability signals for retrieval failures.

## Verification checklist

1. Run `yarn tsc --noEmit -p server` after server-side retrieval changes.
2. Run `yarn dev` and confirm chat still works with and without Neo4j availability.
3. Confirm lore stays concise and relevant to the latest turn.
