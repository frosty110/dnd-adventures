// IMPORTANT: Run this script AFTER generating real trace data in Datadog.
// The trace_stream widget requires at least one span from the service to have been emitted
// before the dashboard will show live data. Run the 3-turn demo flow first, then run this script.
//
// Usage: DD_API_KEY=<api-key> DD_APP_KEY=<app-key> yarn create-dashboard
//        DD_DASHBOARD_ID=<id> to update an existing dashboard
// DD_APP_KEY is a Datadog Application Key — create one at:
//   Datadog > Organization Settings > Application Keys > New Key

import {
  apiReliability,
  llmPipelineLatency,
  llmCost,
  bedrockReliability,
  neo4jRag,
  minimaxTts,
  mediaGeneration,
  streamReliability,
  errorEvents,
  toolSpans,
  llmSpanDetail,
  cachePerformance,
  cacheMetrics,
  runtimeHealth,
} from './sections/index.js';

const DD_API_KEY = process.env.DD_API_KEY;
const DD_APP_KEY = process.env.DD_APP_KEY;
const DD_DASHBOARD_ID = process.env.DD_DASHBOARD_ID;
const DD_SITE = process.env.DD_SITE || 'datadoghq.com';

if (!DD_API_KEY || !DD_APP_KEY) {
  console.error('DD_API_KEY and DD_APP_KEY are required.');
  process.exit(1);
}

const dashboard = {
  title: '[Hackathon] D&D Adventures - LLM Observability',
  description:
    'Full-stack observability for the D&D Adventures hackathon demo. ' +
    'Covers API reliability, LLM cost/latency, Bedrock, Neo4j RAG, MiniMax TTS, and runtime health.',
  layout_type: 'ordered',
  template_variables: [
    { name: 'env', available_values: [], default: 'hackathon' },
    { name: 'service', available_values: [], default: 'dnd-adventures' },
  ],
  widgets: [
    apiReliability,
    llmPipelineLatency,
    llmCost,
    bedrockReliability,
    neo4jRag,
    minimaxTts,
    mediaGeneration,
    streamReliability,
    errorEvents,
    toolSpans,
    llmSpanDetail,
    cachePerformance,
    cacheMetrics,
    runtimeHealth,
  ],
  notify_list: [],
  reflow_type: 'auto',
};

async function main(): Promise<void> {
  const base = `https://api.${DD_SITE}/api/v1/dashboard`;
  const headers = {
    'Content-Type': 'application/json',
    'DD-API-KEY': DD_API_KEY!,
    'DD-APPLICATION-KEY': DD_APP_KEY!,
  };

  if (DD_DASHBOARD_ID) {
    const res = await fetch(`${base}/${DD_DASHBOARD_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(dashboard),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      console.error('Update failed:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
    console.log('Dashboard updated:', data.url);
  } else {
    const res = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify(dashboard),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      console.error('Create failed:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
    console.log('Dashboard created:', data.url);
    console.log('To update this dashboard later, set DD_DASHBOARD_ID=' + data.id);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('403')) {
    console.error(
      '403 Forbidden — ensure DD_APP_KEY is set (Application Key, not API Key).\n' +
        'Create one at: Datadog > Organization Settings > Application Keys > New Key'
    );
  } else {
    console.error('Dashboard creation failed:', message);
  }
  process.exit(1);
});
