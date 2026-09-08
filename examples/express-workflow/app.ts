import { type Snapshot, createActor } from 'xstate';
import { randomUUID } from 'node:crypto';
import bodyParser from 'body-parser';

import express from 'express';
import { machine } from './machine';

export function createWorkflowApp() {
  const persistedStates = new Map<string, Snapshot<unknown>>();
  const app = express();

  app.use(bodyParser.json());

  // Endpoint to start a new workflow instance
  // - Generates a unique ID for the actor
  // - Starts the actor
  // - Persists the actor state
  // - Returns the actor ID in the response
  app.post('/workflows', (_req, res) => {
    const workflowId = randomUUID(); // generate a unique ID
    const actor = createActor(machine).start();

    persistedStates.set(workflowId, actor.getPersistedSnapshot());

    actor.stop();
    res.send({ workflowId });
  });

  // Endpoint to send events to an existing workflow instance
  // - Gets the actor ID from request params
  // - Gets the persisted state for that actor
  // - Sends the event from the request body to the actor
  // - Persists the updated state
  // - Returns the updated state in the response
  app.post('/workflows/:workflowId', (req, res) => {
    const { workflowId } = req.params;
    const snapshot = persistedStates.get(workflowId);

    if (!snapshot) {
      return res.status(404).send('Actor not found');
    }

    const event = req.body;
    if (!event || typeof event !== 'object' || event.type !== 'TIMER') {
      return res.status(400).send('Expected a TIMER event');
    }
    const actor = createActor(machine, { snapshot }).start();
    try {
      actor.send(event);
      persistedStates.set(workflowId, actor.getPersistedSnapshot());
    } finally {
      actor.stop();
    }

    res.sendStatus(200);
  });

  // Endpoint to get the current state of an existing workflow instance
  // - Gets the actor ID from request params
  // - Gets the persisted state for that actor
  // - Returns the persisted state in the response
  app.get('/workflows/:workflowId', (req, res) => {
    const { workflowId } = req.params;
    const persistedState = persistedStates.get(workflowId);

    if (!persistedState) {
      return res.status(404).send('Actor not found');
    }

    res.json(persistedState);
  });

  app.get('/', (_, res) => {
    res.send(`
    <html>
      <body style="font-family: sans-serif;">
        <h1>Express Workflow</h1>
        <p>Start a new workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows</pre>
        <p>Send an event to a workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows/:workflowId -d '{"type":"TIMER"}' -H "Content-Type: application/json" </pre>
        <p>Get the current state of a workflow instance:</p>
        <pre>curl -X GET http://localhost:4242/workflows/:workflowId</pre>
      </body>
    </html>
  `);
  });

  return app;
}
