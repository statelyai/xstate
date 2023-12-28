import { createActor } from 'xstate';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { donutMachine } from './donutMachine';

const uri = '<your mongodb connection string>';

const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1
});
const db = client.db('donut-maker');
const donutCollection = db.collection('donuts');
const options = { upsert: true };
const filter = { persistedState: { $exists: true } };

let restoredState;

try {
  await client.connect();
  restoredState = await donutCollection.findOne();
  if (!restoredState) {
    console.log('no persisted state found in db. starting from scratch.');
  }
  console.log('restored state: ', restoredState);

  const actor = createActor(donutMachine, {
    state: restoredState?.persistedState
  });

  actor.subscribe({
    async next(snapshot) {
      // save persisted state to mongodb
      const persistedState = actor.getPersistedState();
      const updateDoc = {
        $set: {
          persistedState
        }
      };

      const result = await donutCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      // only log if the upsert occurred
      if (result.modifiedCount > 0 || result.upsertedCount > 0) {
        console.log('persisted state saved to db. ', result);
      }

      console.log(
        'Current state:',
        // the current state, bolded
        `\x1b[1m${JSON.stringify(snapshot.value)}\x1b[0m\n`,
        'Next events:',
        // the next events, each of them bolded
        snapshot.nextEvents
          .filter((event) => !event.startsWith('done.'))
          .map((event) => `\n  \x1b[1m${event}\x1b[0m`)
          .join(''),
        '\nEnter the next event to send:'
      );
    },
    async complete() {
      console.log('workflow completed', actor.getSnapshot().output);
      await client.close();
    }
  });

  actor.start();

  process.stdin.on('data', (data) => {
    const eventType = data.toString().trim();
    actor.send({ type: eventType });
  });
} catch (e) {
  console.log('error details: ', e);
  restoredState = undefined;
}
