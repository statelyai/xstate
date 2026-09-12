import express from 'express';
import {
  collections,
  getDurableActor,
  initDbConnection
} from './services/actorService';
import { creditCheckMachine } from './machine';

const app = express();

app.use(express.json());

// Create a new workflow instance and return its ID.
app.post('/workflows', async (_req, res) => {
  try {
    const { workflowId } = await getDurableActor({
      machine: creditCheckMachine
    });
    res
      .status(201)
      .json({ message: 'New workflow created successfully', workflowId });
  } catch (err) {
    console.log(err);
    res.status(500).send(`Error starting workflow. Details: ${err}`);
  }
});

// Restore a workflow instance and send it an event.
app.post('/workflows/:workflowId', async (req, res) => {
  try {
    const { actor } = await getDurableActor({
      machine: creditCheckMachine,
      workflowId: req.params.workflowId
    });
    actor.send(req.body);
  } catch (err) {
    // A real API would map error types to status codes.
    console.log(err);
    res.status(500).send(`Error sending event. Details: ${err}`);
    return;
  }

  res.send('Event received. Issue a GET request to see the workflow state.');
});

// Read the persisted snapshot of a workflow instance.
app.get('/workflows/:workflowId', async (req, res) => {
  const persistedState = await collections.machineStates?.findOne({
    workflowId: req.params.workflowId
  });

  if (!persistedState) {
    res.status(404).send('Workflow state not found');
    return;
  }

  res.json(persistedState);
});

app.get('/', (_req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif;">
        <h1>Credit check workflow</h1>
        <p>Start a new workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows</pre>
        <p>Send an event to a workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows/:workflowId -H 'Content-Type: application/json' -d '{"type":"Submit","SSN":"123456789","firstName":"Gavin","lastName":"Bauman"}'</pre>
        <p>Get the current state of a workflow instance:</p>
        <pre>curl -X GET http://localhost:4242/workflows/:workflowId</pre>
      </body>
    </html>
  `);
});

initDbConnection().then(() => {
  app.listen(4242, () => {
    console.log('Server listening on port 4242');
  });
});
