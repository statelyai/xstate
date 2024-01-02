# Express simple workflow engine

This is a simple workflow engine built with:

- XState v5
- TypeScript
- Express

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/main/examples/express-workflow?file=index.ts)

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
  "workflowId": "7ky252"
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
