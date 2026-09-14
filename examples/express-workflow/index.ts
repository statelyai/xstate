import express from 'express';
import { createActor, type Snapshot } from 'xstate';
import { machine } from './machine';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const persistedSnapshots = new Map<string, Snapshot<unknown>>();

function generateWorkflowId() {
  return Math.random().toString(36).substring(2, 8);
}

const app = express();

app.use(express.json());

// Start a new workflow instance and persist its initial snapshot.
app.post('/workflows', (_req, res) => {
  const workflowId = generateWorkflowId();
  const actor = createActor(machine, { inspect: inspector?.inspect }).start();

  persistedSnapshots.set(workflowId, actor.getPersistedSnapshot());
  actor.stop();

  res.send({ workflowId });
});

// Restore a workflow instance, send it an event, and persist the next snapshot.
app.post('/workflows/:workflowId', (req, res) => {
  const { workflowId } = req.params;
  const snapshot = persistedSnapshots.get(workflowId);

  if (!snapshot) {
    res.status(404).send('Workflow not found');
    return;
  }

  const actor = createActor(machine, {
    snapshot,
    inspect: inspector?.inspect
  }).start();
  actor.send(req.body);

  persistedSnapshots.set(workflowId, actor.getPersistedSnapshot());
  actor.stop();

  res.json(persistedSnapshots.get(workflowId));
});

// Read the persisted snapshot of a workflow instance.
app.get('/workflows/:workflowId', (req, res) => {
  const snapshot = persistedSnapshots.get(req.params.workflowId);

  if (!snapshot) {
    res.status(404).send('Workflow not found');
    return;
  }

  res.json(snapshot);
});

app.get('/', (_req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif;">
        <h1>Express Workflow</h1>
        <p>Start a new workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows</pre>
        <p>Send an event to a workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows/:workflowId -d '{"type":"TIMER"}' -H "Content-Type: application/json"</pre>
        <p>Get the current state of a workflow instance:</p>
        <pre>curl -X GET http://localhost:4242/workflows/:workflowId</pre>
      </body>
    </html>
  `);
});

app.listen(4242, () => {
  console.log('Server listening on port 4242');
});
