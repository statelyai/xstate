# Express Credit Check Workflow

This is a simple workflow engine built with:

- XState v6 alpha
- TypeScript
- Express

This is a modified version of the express-workflow project that shows how to implement state hydration in the `actorService.ts` file.
It also uses a more complex machine with guards, actions, and parallel states configured.

**NOTE**: This project is _not_ production-ready and is intended for educational purposes.

## Usage

[MongoDB](https://www.mongodb.com/docs/manual/administration/install-community/) should be configured with a database named `creditCheck`.

We recommend installing the [MongoDB Compass app](https://www.mongodb.com/products/tools/compass) to view the contents of your database while you run this project.

<!-- Runtime commands from package.json; connection and persistence lifecycle from services/actorService.ts. -->

From the repository root, run `pnpm install` and `pnpm build`. Then start this directory with a connection string:

```sh
MONGODB_URI='mongodb://localhost:27017' pnpm start
```

The connection initializes `machineStates`, `creditReports`, and `creditProfiles` in the `creditCheck` database. The API reuses one live actor per workflow in this process, captures each snapshot before queueing writes, and waits for queued writes before acknowledging API events. Background bureau requests continue after the response. Successful checks complete the workflow; completed or failed actors leave the cache after their final persistence work, and restoration does not repeat completion effects. Ctrl-C stops actors, drains writes, and closes MongoDB. This single-process example does not provide distributed actor ownership.

Existing bureau reports are reused. Newly fetched scores are saved under the corresponding bureau; the final profile includes its numeric middle score and generated rate. Database failures return an error or produce a retryable workflow error instead of disappearing in async subscriptions.

`pnpm build` checks types. Repository regressions mock database/service boundaries and exercise the HTTP app locally; they do not validate a live MongoDB deployment.

## Endpoints

### POST `/workflows`

Creates a new workflow instance.

```bash
curl -X POST http://localhost:4242/workflows
```

Example response:
`201 - Created`

```json
{
  "message": "New workflow created successfully",
  "workflowId": "18d24758-bbf8-45c7-8b15-becdfb759efe"
}
```

### POST `/workflows/:id`

`200 - OK`

Sends an event to a workflow instance.

```bash
# Replace :id with the workflow ID; e.g. http://localhost:4242/workflows/7ky252
# the body should be JSON
curl -X POST http://localhost:4242/workflows/:id -d '{"type": "Submit", "SSN": "123456789", "lastName": "Bauman", "firstName": "Gavin"}' -H "Content-Type: application/json"
```

### GET `/workflows/:id`

Gets the current state of a workflow instance.

```bash
curl -X GET http://localhost:4242/workflows/:id
```

Invalid event shapes return 400, unknown workflow IDs return 404, and database failures return 500.
