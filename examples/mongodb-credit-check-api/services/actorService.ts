import * as mongoDB from 'mongodb';
import { createActor, type AnyStateMachine } from 'xstate';

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';

export const collections: {
  machineStates?: mongoDB.Collection;
  creditReports?: mongoDB.Collection;
  creditProfiles?: mongoDB.Collection;
} = {};

export async function initDbConnection() {
  const client = new mongoDB.MongoClient(uri);
  await client.connect();

  const db = client.db('creditCheck');
  collections.machineStates = db.collection('machineStates');
  collections.creditReports = db.collection('creditReports');
  collections.creditProfiles = db.collection('creditProfiles');
}

/**
 * Returns a started actor for `workflowId`, restored from its persisted
 * snapshot. Without a `workflowId`, a new workflow is created. The actor
 * persists its snapshot on every transition.
 */
export async function getDurableActor({
  machine,
  workflowId
}: {
  machine: AnyStateMachine;
  workflowId?: string;
}) {
  let snapshot;

  if (workflowId) {
    const stored = await collections.machineStates?.findOne({ workflowId });

    if (!stored) {
      throw new Error('No workflow found with the provided workflowId');
    }

    snapshot = stored.persistedState;
  } else {
    workflowId = generateWorkflowId();
  }

  const actor = createActor(machine, { snapshot });

  actor.subscribe({
    next: async () => {
      const result = await collections.machineStates?.replaceOne(
        { workflowId },
        { workflowId, persistedState: actor.getPersistedSnapshot() },
        { upsert: true }
      );

      if (!result?.acknowledged) {
        throw new Error(
          'Error persisting actor state. Verify the db connection is configured correctly.'
        );
      }
    },
    error: (err) => {
      console.log('Error in actor subscription:', err);
    },
    complete: () => {
      console.log('Workflow finished');
      actor.stop();
    }
  });

  actor.start();

  return { actor, workflowId };
}

function generateWorkflowId() {
  return Math.random().toString(36).substring(2, 8);
}
