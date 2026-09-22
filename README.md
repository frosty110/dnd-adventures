# D&D Adventures

A production-quality AI-powered Dungeon Master for tabletop D&D, serving ~1000 concurrent players with immersive open-ended gameplay, voice narration, and full observability.

## Features

- **AI Dungeon Master** -- Claude via AWS Bedrock generates narrative responses with full D&D context (the AI DM powering D&D Adventures)
- **Single-Player & Multiplayer** -- Solo adventures or 2-4 player parties with real-time turn management
- **Voice Narration** -- MiniMax TTS with emotion tags, mood prosody, and multi-character voices
- **Knowledge Graph RAG** -- Neo4j-powered lore retrieval injects world context into every response
- **Background Music** -- Mood-based music generation (tavern, combat, mystery, dramatic, danger)
- **Dice Rolling** -- Animated d20 roller with DM narration of outcomes by roll bracket
- **Character Creation** -- Class selection (6 classes), gender, and custom pronouns
- **LLM Observability** -- Full Datadog tracing across Bedrock, Neo4j, TTS, and music pipelines

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS v4, Socket.IO Client |
| Backend | Node.js 22, Express 5, TypeScript 5, Socket.IO |
| LLM | AWS Bedrock (Claude 3 Haiku) via `@aws-sdk/client-bedrock-runtime` |
| Knowledge Graph | Neo4j AuraDB with Cypher RAG pipeline |
| Voice/Audio | MiniMax TTS (speech-2.8-hd / speech-2.8-turbo) |
| Observability | Datadog dd-trace with LLM Observability |
| Real-time | Socket.IO for multiplayer turn orchestration |

## Quick Start

### Prerequisites

- Node.js 22+
- Yarn 1.22+
- AWS account with Bedrock Claude model access enabled
- Neo4j AuraDB instance (optional -- degrades gracefully)
- MiniMax API key (optional -- text-only mode without it)
- Datadog API key (optional -- tracing disabled without it)

### Installation

```bash
git clone <repo-url>
cd awsHackathon
yarn install
```

### Environment Setup

```bash
cp .env.example .env
```

Required for basic chat:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
PORT=3001
NODE_ENV=development
```

See [Developer Guide](docs/DEVELOPER-GUIDE.md) for the full environment variable reference.

### Running

```bash
# Start both client and server concurrently
yarn dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Seed the Knowledge Graph (optional)

```bash
yarn seed
```

## Project Structure

```
awsHackathon/
  client/                  # React frontend (Vite + Tailwind v4)
    src/
      components/          # UI components (ChatWindow, DiceRoller, etc.)
      hooks/               # Custom hooks (useSSEChat, useMultiplayerRoom)
      services/            # Audio controller, background music, socket client
      types/               # TypeScript type definitions
  server/                  # Node.js/Express backend
    src/
      routes/              # REST API endpoints (chat, narrate, music, health)
      services/            # Core services (bedrock, tts, rag, neo4j, etc.)
      sockets/             # Socket.IO event handlers (rooms, turns, chat)
  docs/                    # Project documentation
  skills/                  # AI operator skill guides
  .planning/               # Roadmap, requirements, architecture docs
```

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API.md) | REST endpoints and request/response schemas |
| [Socket Events](docs/SOCKET-EVENTS.md) | Real-time multiplayer event reference |
| [Architecture](docs/ARCHITECTURE.md) | System diagrams, data flows, design decisions |
| [Services Reference](docs/SERVICES.md) | Backend service internals and configuration |
| [Developer Guide](docs/DEVELOPER-GUIDE.md) | Setup, workflow, contributing guidelines |

## Architecture Overview

```
  React Chat UI ──(SSE)──> Express /api/chat ──> AWS Bedrock (Claude)
       │                        │
       │                        ├──> Neo4j RAG (lore injection)
       │                        └──> MiniMax TTS (voice narration)
       │
  Socket.IO Client ──(WS)──> Socket.IO Server
       │                        │
       │                        ├──> Room management (create/join/ready)
       │                        ├──> Turn orchestration (30s timer)
       │                        └──> Player chat & dice rolls
       │
  Datadog dd-trace ────────> All pipeline stages traced
```

## Datadog Observability

Live dashboards:

- [LLM Observability -- Traces & Spans](https://app.datadoghq.com/llm/applications?query=%40ml_app%3Adnd-adventures&compareLens=inputs&fromUser=false&selectedTab=overview)
- [Hackathon Dashboard -- D&D Adventures](https://app.datadoghq.com/dashboard/agm-v77-h47/hackathon-dnd-adventures---llm-observability)

### Creating / Updating the Dashboard

```bash
yarn create-dashboard
# Or update existing:
DD_DASHBOARD_ID=agm-v77-h47 yarn create-dashboard
```

### Key Tracing Config

Tracing bootstraps via `NODE_OPTIONS='--import dd-trace/initialize.mjs'`:

| Variable | Purpose |
|----------|---------|
| `DD_SERVICE` | Service name for APM (`dnd-adventures`) |
| `DD_ENV` | Environment tag (`hackathon`) |
| `DD_LLMOBS_ENABLED` | Enable LLM Observability |
| `DD_LLMOBS_ML_APP` | ML app name for span filtering (`dnd-adventures`) |
| `DD_LLMOBS_AGENTLESS_ENABLED` | Send LLMObs data directly (no Agent) |
| `DD_TRACE_AWS_SDK_BEDROCKRUNTIME_ENABLED` | Auto-instrument Bedrock calls |

## Operator Skill Files

- `skills/datadog-dashboard-operator/SKILL.md`
- `skills/datadog-llmobs-operator/SKILL.md`
- `skills/bedrock-runtime-operator/SKILL.md`
- `skills/neo4j-rag-operator/SKILL.md`
- `skills/dnd-game-ux/SKILL.md`

## AI Context Symlinks

- `CLAUDE.md` -- Source file for AI assistant context
- `AGENTS.md` -- Symlink to `CLAUDE.md` (Codex/Kiro)
- `agent.md` -- Symlink to `CLAUDE.md` (local alias)
