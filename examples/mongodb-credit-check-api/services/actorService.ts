import * as mongoDB from 'mongodb';
import { randomUUID } from 'node:crypto';
import { type AnyStateMachine, createActor } from 'xstate';

export const collections: {
  machineStates?: mongoDB.Collection;
  creditReports?: mongoDB.Collection;
  creditProfiles?: mongoDB.Collection;
} = {};

let client: mongoDB.MongoClient | undefined;
const actors = new Map<string, ReturnType<typeof startDurableActor>>();

export async function initDbConnection(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('Set MONGODB_URI to run the credit-check API.');
  client = new mongoDB.MongoClient(uri, {
    serverApi: mongoDB.ServerApiVersion.v1
  });
  try {
    await client.connect();
    const db = client.db('creditCheck');
    collections.machineStates = db.collection('machineStates');
    collections.creditReports = db.collection('creditReports');
    collections.creditProfiles = db.collection('creditProfiles');
  } catch (error) {
    await client.close();
    throw error;
  }
}

export class WorkflowNotFoundError extends Error {}

async function startDurableActor(
  machine: AnyStateMachine,
  workflowId: string,
  restore: boolean,
  onTerminal: () => void
) {
  const collection = collections.machineStates;
  if (!collection) throw new Error('Database is not connected');
  const restored = restore
    ? await collection.findOne({ workflowId })
    : undefined;
  if (restore && !restored)
    throw new WorkflowNotFoundError('Workflow not found');
  const actor = createActor(machine, { snapshot: restored?.persistedState });
  let tail = Promise.resolve();
  let failed = false;
  let failure: unknown;
  const reportError = (error: unknown) => {
    failed = true;
    failure = error;
    console.error('Could not persist workflow:', error);
  };
  let retiring = false;
  async function retire() {
    if (retiring) return;
    retiring = true;
    try {
      await flush();
    } catch {
      // Persistence and actor errors are already reported to the caller.
    } finally {
      subscription.unsubscribe();
      onTerminal();
    }
  }
  const subscription = actor.subscribe({
    next() {
      const persistedState = actor.getPersistedSnapshot();
      tail = tail
        .then(async () => {
          const result = await collection.replaceOne(
            { workflowId },
            { workflowId, persistedState },
            { upsert: true }
          );
          if (!result.acknowledged)
            throw new Error('Workflow persistence was not acknowledged');
          failed = false;
        })
        .catch(reportError);
      if (actor.getSnapshot().status === 'done') void retire();
    },
    complete() {
      void retire();
    },
    error(error) {
      reportError(error);
      void retire();
    }
  });
  async function flush() {
    // Writes triggered while waiting must also settle before an API response.
    let pending;
    do {
      pending = tail;
      await pending;
    } while (pending !== tail);
    if (failed) throw failure;
    const snapshot = actor.getSnapshot();
    if (snapshot.status === 'error') throw snapshot.error;
  }
  actor.start();
  try {
    await flush();
  } catch (error) {
    actor.stop();
    throw error;
  }
  return { actor, workflowId, flush };
}

export function getDurableActor({
  machine,
  workflowId
}: {
  machine: AnyStateMachine;
  workflowId?: string;
}) {
  const id = workflowId ?? randomUUID();
  const existing = actors.get(id);
  if (existing) return existing;
  const pending = startDurableActor(
    machine,
    id,
    workflowId !== undefined,
    () => {
      if (actors.get(id) === pending) actors.delete(id);
    }
  );
  actors.set(id, pending);
  void pending.catch(() => {
    if (actors.get(id) === pending) actors.delete(id);
  });
  return pending;
}

export async function closeDurableActors() {
  const pending = [...actors.values()];
  actors.clear();
  try {
    const results = await Promise.allSettled(
      pending.map(async (entry) => {
        const durable = await entry;
        durable.actor.stop();
        await durable.flush();
      })
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  } finally {
    await client?.close();
  }
}
