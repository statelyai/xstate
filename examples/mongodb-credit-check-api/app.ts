import bodyParser from 'body-parser';
import {
  collections,
  getDurableActor,
  WorkflowNotFoundError
} from './services/actorService';
import express, {
  type Request,
  type Response,
  type RequestHandler
} from 'express';
import { creditCheckMachine } from './machine';

function handleAsync(
  handler: (request: Request, response: Response) => Promise<unknown>
): RequestHandler {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}

export function createCreditCheckApp() {
  const app = express();

  app.use(bodyParser.json());

  // Endpoint to start a new workflow instance
  // - Generates a unique ID for the actor
  // - Starts the actor
  // - Persists the actor state
  // - Returns a 201-Created code with the actor ID in the response
  app.post(
    '/workflows',
    handleAsync(async (_req, res) => {
      console.log('starting new workflow...');
      try {
        // Create a new actor and get its ID
        const { workflowId } = await getDurableActor({
          machine: creditCheckMachine
        });
        res
          .status(201)
          .json({ message: 'New workflow created successfully', workflowId });
      } catch (err) {
        console.log(err);
        res
          .status(500)
          .send('Error starting workflow. Details: ' + String(err));
      }
    })
  );

  // Endpoint to send events to an existing workflow instance
  // - Gets the actor ID from request params
  // - Gets the persisted state for that actor
  // - Starts the actor with the persisted state
  // - Sends the event from the request body to the actor
  // - Persists the updated state
  // - Returns the updated state in the response
  app.post(
    '/workflows/:workflowId',
    handleAsync(async (req, res) => {
      const { workflowId } = req.params;
      const event = req.body;
      if (
        !event ||
        event.type !== 'Submit' ||
        typeof event.SSN !== 'string' ||
        typeof event.firstName !== 'string' ||
        typeof event.lastName !== 'string'
      ) {
        return res
          .status(400)
          .send('Expected a Submit event with SSN, firstName and lastName');
      }

      try {
        const { actor, flush } = await getDurableActor({
          machine: creditCheckMachine,
          workflowId
        });
        actor.send(event);
        await flush();
      } catch (err) {
        // note: you can (and should!) create custom errors to handle different scenarios and return different status codes
        console.log(err);
        return res
          .status(err instanceof WorkflowNotFoundError ? 404 : 500)
          .send('Error sending event. Details: ' + String(err));
      }

      res
        .status(200)
        .send(
          'Event received. Issue a GET request to see the current workflow state'
        );
    })
  );

  // Endpoint to get the current state of an existing workflow instance
  // - Gets the actor ID from request params
  // - Gets the persisted state for that actor
  // - Returns the persisted state in the response
  app.get(
    '/workflows/:workflowId',
    handleAsync(async (req, res) => {
      const { workflowId } = req.params;
      try {
        if (!collections.machineStates)
          throw new Error('Database is not connected');
        const persistedState = await collections.machineStates.findOne({
          workflowId
        });
        if (!persistedState)
          return res.status(404).send('Workflow state not found');
        return res.json(persistedState);
      } catch (error) {
        return res
          .status(500)
          .send('Could not read workflow: ' + String(error));
      }
    })
  );

  app.get('/', (_, res) => {
    res.send(`
    <html>
      <body style="font-family: sans-serif;">
        <h1>Express Workflow</h1>
        <p>Start a new workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows</pre>
        <p>Send an event to a workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows/:workflowId -H "Content-Type: application/json" -d '{"type":"Submit","SSN":"123456789","firstName":"Ada","lastName":"Lovelace"}'</pre>
        <p>Get the current state of a workflow instance:</p>
        <pre>curl -X GET http://localhost:4242/workflows/:workflowId</pre>
      </body>
    </html>
  `);
  });

  return app;
}
