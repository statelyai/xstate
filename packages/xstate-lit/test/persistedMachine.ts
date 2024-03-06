import { createActor, createMachine } from 'xstate';
import { fetchMachine } from './fetchMachine.ts';

const actorRef = createActor(
  fetchMachine.provide({
    actors: {
      fetchData: createMachine({
        initial: 'done',
        states: {
          done: {
            type: 'final'
          }
        },
        output: 'persisted data'
      }) as any
    }
  })
).start();

actorRef.send({ type: 'FETCH' });

export const persistedFetchState = actorRef.getPersistedSnapshot();

export const persistedFetchStateConfig = JSON.parse(
  JSON.stringify(persistedFetchState)
);
