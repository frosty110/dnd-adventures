# D&D Adventures — Datadog Dashboard

Programmatic Datadog dashboard creation via the REST API. Produces a single ordered dashboard titled **[Hackathon] D&D Adventures - LLM Observability** containing 12 widget groups that cover the full observability stack.

## Usage

```sh
# Create a new dashboard
DD_API_KEY=<key> DD_APP_KEY=<app-key> yarn create-dashboard

# Update an existing dashboard
DD_DASHBOARD_ID=<id> DD_API_KEY=<key> DD_APP_KEY=<app-key> yarn create-dashboard
```

> Run this script **after** generating real trace data (e.g. a 3-turn demo flow) so that stream-based widgets populate correctly.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DD_API_KEY` | Yes | Datadog API key |
| `DD_APP_KEY` | Yes | Datadog Application key (Organization Settings > Application Keys) |
| `DD_DASHBOARD_ID` | No | Pass to update an existing dashboard instead of creating one |
| `DD_SITE` | No | Datadog site domain (default: `datadoghq.com`) |

## Template Variables

The dashboard exposes two template variables used across all widget queries:

| Variable | Default | Purpose |
|----------|---------|---------|
| `$env` | `hackathon` | Filter by environment tag |
| `$service` | `dnd-adventures` | Filter by service tag |

## Dashboard Sections

The dashboard is composed of 12 group widgets, rendered top-to-bottom in the order listed below. Each group is defined in its own file under `sections/`.

### 1. API Reliability — `/chat` & `/narrate`

**File:** `sections/api-reliability.ts` &middot; **Data source:** APM metrics

Monitors the Express HTTP layer across all endpoints.

| Widget | Type | What it shows |
|--------|------|---------------|
| Request Rate by Endpoint | timeseries (bars) | `trace.express.request.hits` grouped by `resource_name` |
| Error Rate by Endpoint | timeseries (bars) | `trace.express.request.errors` grouped by `resource_name` |
| p95 Latency by Endpoint | timeseries (line) | `p95:trace.express.request` grouped by `resource_name` |

### 2. LLM Pipeline — End-to-End Latency

**File:** `sections/llm-pipeline-latency.ts` &middot; **Data source:** LLM Observability

Tracks the full chat pipeline latency from root spans (spans with no parent).

| Widget | Type | What it shows |
|--------|------|---------------|
| Root Span Latency Percentiles | timeseries (line) | avg, p75, p90, p95 of `@duration` for root-level LLM Obs spans |

### 3. LLM Cost — Token Spend

**File:** `sections/llm-cost.ts` &middot; **Data source:** LLM Observability

Tracks token costs by model and category.

| Widget | Type | What it shows |
|--------|------|---------------|
| Total Cost by Model | toplist | `@metrics.estimated_total_cost` grouped by `model_provider` and `model_name` (displayed in dollars) |
| Cost Breakdown Over Time | timeseries (bars) | Stacked breakdown: non-cached input, cache-read input, cache-write input, and output costs |

### 4. Bedrock Reliability

**File:** `sections/bedrock-reliability.ts` &middot; **Data source:** APM metrics

Monitors AWS Bedrock Runtime calls.

| Widget | Type | What it shows |
|--------|------|---------------|
| Bedrock Call Latency (avg / p95) | timeseries (line) | `trace.aws.bedrockruntime.command` avg and p95 |
| Bedrock Errors | timeseries (bars) | `trace.aws.bedrockruntime.command.errors` count |

### 5. Neo4j RAG — Lore Retrieval

**File:** `sections/neo4j-rag.ts` &middot; **Data source:** LLM Observability

Monitors the RAG pipeline that retrieves D&D lore from Neo4j.

| Widget | Type | What it shows |
|--------|------|---------------|
| Lore Query Latency (avg / p95) | timeseries (line) | `@duration` for `neo4j.lore_query` spans |
| Lore Queries (total) | query_value | Total count of lore query spans |
| Lore Query Failures | query_value | Count of error-status lore query spans (red/green conditional format) |

### 6. MiniMax TTS — Narration

**File:** `sections/minimax-tts.ts` &middot; **Data source:** LLM Observability

Monitors the text-to-speech narration pipeline.

| Widget | Type | What it shows |
|--------|------|---------------|
| TTS Narration Latency (avg / p95) | timeseries (line) | `@duration` for `minimax.tts` spans |
| TTS Failures | query_value | Count of error-status TTS spans (red/green conditional format) |

### 7. Stream Reliability — SSE

**File:** `sections/stream-reliability.ts` &middot; **Data source:** APM metrics

Monitors the SSE chat streaming endpoint specifically.

| Widget | Type | What it shows |
|--------|------|---------------|
| Chat Streams: Started vs Errors | timeseries (bars) | `trace.express.request.hits` and `.errors` for `post_/api/chat` |

### 8. Tool Spans — Usage & Errors

**File:** `sections/tool-spans.ts` &middot; **Data source:** LLM Observability

Summary table of all tool-kind spans in the LLM pipeline.

| Widget | Type | What it shows |
|--------|------|---------------|
| Tool Span Summary | query_table | Count, avg duration, and error count per tool span name (red/green conditional format on errors) |

### 9. LLM Span Detail — Prompts & Tokens

**File:** `sections/llm-span-detail.ts` &middot; **Data source:** LLM Observability (stream)

Live event list showing individual LLM and embedding spans.

| Widget | Type | What it shows |
|--------|------|---------------|
| LLM & Embedding Spans (by cost) | list_stream | Status, timestamp, model name, input preview, input/output/total tokens, estimated cost — sorted by cost descending |

### 10. Cache Performance — TTS / Lore / Music

**File:** `sections/cache-performance.ts` &middot; **Data source:** Logs

Log-based cache hit/miss tracking for the three cache layers.

| Widget | Type | What it shows |
|--------|------|---------------|
| TTS Cache — Hits vs Misses vs API Calls | timeseries (bars) | Log events: `tts.cache_hit`, `tts.cache_miss`, `tts.api_call_completed` |
| Lore Cache — Hits vs Misses | timeseries (bars) | Log events: `rag.cache_hit`, `rag.cache_miss` |
| Music Cache — Hits vs Misses | timeseries (bars) | Log events: `music.cache_hit`, `music.cache_miss` |
| Cache Hit Ratios | query_table | Event counts grouped by `@event` for TTS, Lore, and Music |

### 11. Cache Metrics (DogStatsD) — Real-Time

**File:** `sections/cache-metrics.ts` &middot; **Data source:** Custom metrics (DogStatsD)

StatsD-based cache metrics with computed hit ratios.

| Widget | Type | What it shows |
|--------|------|---------------|
| Cache Hit Rate by Type | timeseries (bars) | `cache.hit` grouped by `cache_type` |
| Cache Miss Rate by Type | timeseries (bars) | `cache.miss` grouped by `cache_type` |
| Hit Ratio — TTS | query_value | `(hits / (hits + misses)) * 100` for TTS |
| Hit Ratio — Lore | query_value | `(hits / (hits + misses)) * 100` for Lore |
| Hit Ratio — Music | query_value | `(hits / (hits + misses)) * 100` for Music |
| Cache Hits by Source (Memory vs S3) | timeseries (bars) | `cache.hit` grouped by `source` tag |

### 12. Runtime Health

**File:** `sections/runtime-health.ts` &middot; **Data source:** APM metrics + APM traces (stream)

General service health and live trace inspection.

| Widget | Type | What it shows |
|--------|------|---------------|
| Health Check Latency | timeseries (line) | `trace.express.request` for `get_/health` |
| Live APM Traces | list_stream | Live trace stream showing resource name, duration, and status |

## Data Sources Summary

| Source | Used by | Query pattern |
|--------|---------|---------------|
| APM metrics (`metrics`) | Sections 1, 4, 7, 12 | `trace.express.request.*`, `trace.aws.bedrockruntime.command.*` |
| LLM Observability (`llm_observability`) | Sections 2, 3, 5, 6, 8 | `@ml_app:dnd-adventures @event_type:span` with span filters |
| LLM Observability stream (`llm_observability_stream`) | Section 9 | Same base query, rendered as live event list |
| Logs (`logs`) | Section 10 | `service:dnd-adventures @event:<event_name>` |
| Custom metrics / DogStatsD (`metrics`) | Section 11 | `cache.hit`, `cache.miss` with `cache_type` and `source` tags |
| APM trace stream (`trace_stream`) | Section 12 | `service:$service env:$env` |

## Directory Structure

```
scripts/create-dashboard/
  index.ts          Entry point — assembles dashboard payload and calls Datadog API
  helpers.ts        Shared constants (LIVE_1H, SVC_ENV, llm())
  sections/
    index.ts        Barrel re-export of all section modules
    *.ts            One file per dashboard group (12 total)
```

## Adding or Modifying Sections

See `CLAUDE.md` in this directory for contributor conventions, helper usage, and step-by-step instructions for adding new sections or widgets.
