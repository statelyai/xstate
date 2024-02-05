# Express Credit Check Workflow

This is a simple workflow engine built with:

- XState v5
- TypeScript
- Express

This is a modified version of the express-workflow project that shows how to implement state hydration in the `actorService.ts` file.
It also uses a more complex machine with guards, actions, and parallel states configured.

**NOTE**: This project is _not_ production-ready and is intended for educational purposes.

## Usage

[MongoDB](https://www.mongodb.com/docs/manual/administration/install-community/) should be configured with a database named `creditCheck`.

We recommend installing the [MongoDB Compass app](https://www.mongodb.com/products/tools/compass) to view the contents of your database while you run this project.

Add the connection string to the DB client in the `actorService.ts` file by updating this line:

```typescript
const uri = "<your mongo uri here>/creditCheck";
```

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
`201 - Created`

```json
{
  {"message":"New worflow created successfully","workflowId":"uzkjyy"}
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
