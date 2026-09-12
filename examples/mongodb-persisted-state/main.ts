import { __unsafe_getAllOwnEventDescriptors } from 'xstate';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { createDonutSession } from './session';

const uri = process.env.MONGODB_URI;
if (!uri)
  throw new Error('Set MONGODB_URI to run the persisted donut example.');
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

try {
  await client.connect();
  const collection = client.db('donut-maker').collection('donuts');
  const filter = { persistedState: { $exists: true } };
  const restored = await collection.findOne(filter);
  if (!restored)
    console.log('No persisted state found. Starting from scratch.');
  const reportError = (error: unknown) => {
    console.error('Persistence failed:', error);
    process.exitCode = 1;
  };
  const { actor, flush } = createDonutSession({
    snapshot: restored?.persistedState,
    async save(persistedState) {
      await collection.updateOne(
        filter,
        { $set: { persistedState } },
        { upsert: true }
      );
    },
    onError: reportError
  });
  let closing: Promise<void> | undefined;
  function shutdown() {
    if (!closing) {
      actor.stop();
      process.stdin.pause();
      closing = flush().then(() => client.close());
      void closing.catch(reportError);
    }
    return closing;
  }
  actor.subscribe({
    next(snapshot) {
      console.log('Current state:', JSON.stringify(snapshot.value));
      console.log(
        'Next events:',
        __unsafe_getAllOwnEventDescriptors(snapshot).join(', ')
      );
    },
    complete() {
      void shutdown();
    }
  });
  actor.start();
  process.stdin.on('data', (data) =>
    actor.send({ type: data.toString().trim() })
  );
  process.once('SIGINT', () => {
    void shutdown();
  });
  process.stdin.once('end', () => {
    void shutdown();
  });
} catch (error) {
  await client.close();
  console.error('Could not start persisted workflow:', error);
  process.exitCode = 1;
}
