import { interpret, waitFor } from '../../packages/core/src/index.ts';

import {
  createActors,
  parentMachine,
  runServiceMachine
} from './rehydrationIssue.ts';

let history: any[] = [];

describe('rehydration issue', () => {
  it('with workingAcotors actorRef should stop in the final {Up: "Done"} state', async () => {
    const workingActors = await createActors(runServiceMachine, 0);

    expect(Object.keys(workingActors).length).toBe(3);

    const actorRef = interpret(
      parentMachine.provide({
        actors: workingActors
      })
    );

    actorRef.subscribe({
      next: (state) => {
        console.log('---next', state.value);
        history = history.concat(JSON.stringify(actorRef.getPersistedState()));
      },
      complete: () => {
        console.log('---complete');
      },
      error: (error) => {
        console.log('error', error);
      }
    });

    actorRef.start();
    actorRef.send({ type: 'UP' });

    const state = waitFor(actorRef, (s) => s.matches({ Up: 'Done' }));
    return expect((await state).value).toStrictEqual({ Up: 'Done' });
  });

  it('with failingActors actorRef should stop in the final {Up: "NotDone"} state', async () => {
    const failingActors = await createActors(runServiceMachine, 1);

    expect(Object.keys(failingActors).length).toBe(3);

    const actorRef = interpret(
      parentMachine.provide({
        actors: failingActors
      })
    );

    actorRef.subscribe({
      next: (state) => {
        console.log('---next', state.value);
        history = history.concat(JSON.stringify(actorRef.getPersistedState()));
      },
      complete: () => {
        console.log('---complete');
      },
      error: (error) => {
        console.log('error', error);
      }
    });

    actorRef.start();
    actorRef.send({ type: 'UP' });

    const state = waitFor(actorRef, (s) => s.matches({ Up: 'NotDone' }));
    return expect((await state).value).toStrictEqual({ Up: 'NotDone' });
  });
  it('when using with the correct persistedState actorRef should start with failing {Up: "Step2"} state and stop in final {Up: "Done"}', async () => {
    const workingActors = await createActors(runServiceMachine, 0);

    //const persistedState = JSON.parse(history[2])
    console.log(history);

    // currentPersistedState has the correct value for "src":"fromPromise2". This breaks the test with a timeout.
    // by replacing  "src":"fromPromise2" with "src":"Whatever" it will start working as expected
    const currentPersistedState = JSON.parse(
      '{"value":{"Up":"Step2"},"done":false,"context":{},"historyValue":{},"_internalQueue":[],"children":{"step2":{"state":{"value":"running","done":false,"context":{"errorCount":0,"threshold":3},"historyValue":{},"_internalQueue":[],"children":{"upDownService":{"state":{"status":"active"},"src":"upDownService"}}},"src":"fromPromise2"}}}'
    );
    console.log(currentPersistedState);
    expect(currentPersistedState.value).toStrictEqual({ Up: 'Step2' });

    const actorRef = interpret(
      parentMachine.provide({
        actors: workingActors
      }),
      { state: currentPersistedState }
    );

    actorRef.subscribe({
      next: (state) => {
        console.log('---next', state.value);
      },
      complete: () => {
        console.log('---complete');
      },
      error: (error) => {
        expect(error.message).toBe(
          'Cannot stop child actor step2 of x:0 because it is not a child'
        );
      }
    });

    actorRef.start();

    const stateStep2 = waitFor(actorRef, (s) => s.matches({ Up: 'Step2' }));
    expect((await stateStep2).value).toStrictEqual({ Up: 'Step2' });

    const stateDone = waitFor(actorRef, (s) => s.matches({ Up: 'Done' }));
    return expect((await stateDone).value).toStrictEqual({ Up: 'Done' });
    // actorRef.stop()
  });

  it('Unexpected: by replacing the valid src with "src":"INVALID"} in perstistedState it starts with {Up: "Step2"} state and stops in final {Up: "Done"}', async () => {
    const workingActors = await createActors(runServiceMachine, 0);

    //const persistedState = JSON.parse(history[2])
    console.log(history[2]);
    const fakePersistedState = JSON.parse(
      '{"value":{"Up":"Step2"},"done":false,"context":{},"historyValue":{},"_internalQueue":[],"children":{"step2":{"state":{"value":"running","done":false,"context":{"errorCount":0,"threshold":3},"historyValue":{},"_internalQueue":[],"children":{"upDownService":{"state":{"status":"active"},"src":"upDownService"}}},"src":"INVALID"}}}'
    );
    expect(fakePersistedState.value).toStrictEqual({ Up: 'Step2' });

    const actorRef = interpret(
      parentMachine.provide({
        actors: workingActors
      }),
      { state: fakePersistedState }
    );

    actorRef.subscribe({
      next: (state) => {
        console.log('---next', state.value);
      },
      complete: () => {
        console.log('---complete');
      },
      error: (error) => {
        expect(error.message).toBe(
          'Cannot stop child actor step2 of x:0 because it is not a child'
        );
      }
    });

    actorRef.start();

    const stateStep2 = waitFor(actorRef, (s) => s.matches({ Up: 'Step2' }));
    expect((await stateStep2).value).toStrictEqual({ Up: 'Step2' });

    const stateDone = waitFor(actorRef, (s) => s.matches({ Up: 'Done' }));
    return expect((await stateDone).value).toStrictEqual({ Up: 'Done' });
    // actorRef.stop()
  });
});
