# Express simple workflow engine

This is a simple workflow engine built with:

- XState v6 alpha
- TypeScript
- Express

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/next/examples/express-workflow?file=index.ts)

<!-- Commands from package.json; endpoints and state ownership from app.ts. -->

## Usage

```bash
pnpm install
pnpm start
```

## Endpoints

### POST `/workflows`

Creates a new workflow instance.

```bash
curl -X POST http://localhost:4242/workflows
```

Example response:

```json
{
  "workflowId": "18d24758-bbf8-45c7-8b15-becdfb759efe"
}
```

### POST `/workflows/:id`

Sends an event to a workflow instance.

```bash
# Replace :id with the workflow ID; e.g. http://localhost:4242/workflows/7ky252
# the body should be JSON
curl -X POST http://localhost:4242/workflows/:id -d '{"type": "TIMER"}' -H "Content-Type: application/json"
```

### GET `/workflows/:id`

Gets the current state of a workflow instance.

```bash
curl -X GET http://localhost:4242/workflows/:id
```

Three `TIMER` events complete one green → yellow → red → green cycle and increment `context.cycles`. Invalid event shapes return 400; missing workflow IDs return 404. State lives in memory and resets when the server restarts. Each request stops its temporary actor after saving the snapshot.
