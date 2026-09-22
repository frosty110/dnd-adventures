# create-dashboard Script

Programmatic Datadog dashboard creation/update via the REST API. Run from project root:

```sh
DD_API_KEY=<key> DD_APP_KEY=<app-key> yarn create-dashboard          # create new
DD_DASHBOARD_ID=<id> DD_API_KEY=<key> DD_APP_KEY=<app-key> yarn create-dashboard  # update existing
```

## Directory Structure

```
scripts/create-dashboard/
  index.ts          # Entry point — env config, dashboard assembly, API call
  helpers.ts        # Shared constants used by all sections
  sections/
    index.ts        # Barrel re-export of all sections
    *.ts            # One file per dashboard group widget (11 total)
```

## How Sections Work

Each file in `sections/` exports a single object representing one Datadog **group widget**. The shape matches the Datadog Dashboard REST API `widget` schema:

```ts
export const mySection = {
  definition: {
    type: 'group',
    layout_type: 'ordered',
    title: 'Section Title',
    widgets: [ /* individual widget definitions */ ],
  },
};
```

`index.ts` imports all section exports and places them in the `widgets` array of the dashboard payload. Order in that array = order on the dashboard.

## Adding a New Section

1. Create `sections/my-new-section.ts`.
2. Import helpers as needed: `import { LIVE_1H, SVC_ENV, llm } from '../helpers.js';`
3. Export a named const following the group widget pattern above.
4. Add the export to `sections/index.ts`.
5. Import and append to the `widgets` array in `index.ts`.

## Adding a Widget to an Existing Section

Open the relevant `sections/*.ts` file and add a new object to its `widgets` array. Use the Datadog widget definition schema — common `type` values: `timeseries`, `query_value`, `toplist`, `query_table`, `list_stream`.

## Shared Helpers (`helpers.ts`)

| Export | Purpose |
|--------|---------|
| `LIVE_1H` | Default time window: `{ type: 'live', unit: 'hour', value: 1 }` |
| `SVC_ENV` | Template variable tag filter: `{service:$service,env:$env}` |
| `llm(extra?)` | LLM Observability base query: `@ml_app:dnd-adventures @event_type:span` with optional extra filters |

## Data Sources

Sections use three Datadog data sources:

- **`metrics`** — APM trace metrics (e.g. `trace.express.request.hits`). Use `SVC_ENV` for template variable filtering.
- **`llm_observability`** — LLM Obs spans. Use `llm()` helper for the base query. Filter with `@parent_id:*`, `@name:`, `@status:error`, `@meta.span.kind:`.
- **`logs`** — Structured log events (cache hits/misses). Filter with `service:dnd-adventures @event:<event_name>`.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DD_API_KEY` | Yes | Datadog API key |
| `DD_APP_KEY` | Yes | Datadog **Application** key (not API key) |
| `DD_DASHBOARD_ID` | No | Set to update an existing dashboard instead of creating a new one |
| `DD_SITE` | No | Datadog site (default: `datadoghq.com`) |
