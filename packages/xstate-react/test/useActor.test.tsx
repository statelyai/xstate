import * as React from 'react';
import { useMachine } from '../src';
import { createMachine, sendParent, Actor, assign, spawn } from 'xstate';
import { render, cleanup } from '@testing-library/react';
import { useActor } from '../src/useActor';

afterEach(cleanup);

describe('useActor', () => {
  it('initial invoked actor should be immediately available', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {}
      }
    });
    const machine = createMachine({
      initial: 'active',
      invoke: {
        id: 'child',
        src: childMachine
      },
      states: {
        active: {}
      }
    });

    const ChildTest: React.FC<{ actor: Actor<any> }> = ({ actor }) => {
      const [state] = useActor(actor);

      expect(state.value).toEqual('active');

      done();

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);

      return <ChildTest actor={state.children.child} />;
    };

    render(
      <React.StrictMode>
        <Test />
      </React.StrictMode>
    );
  });

  it('invoked actor should be able to receive (deferred) events that it replays when active', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent('FINISH') }
          }
        }
      }
    });
    const machine = createMachine({
      initial: 'active',
      invoke: {
        id: 'child',
        src: childMachine
      },
      states: {
        active: {
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest: React.FC<{ actor: Actor<any> }> = ({ actor }) => {
      const [state, send] = useActor(actor);

      expect(state.value).toEqual('active');

      React.useEffect(() => {
        send({ type: 'FINISH' });
      }, []);

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);

      if (state.matches('success')) {
        done();
      }

      return <ChildTest actor={state.children.child} />;
    };

    render(
      <React.StrictMode>
        <Test />
      </React.StrictMode>
    );
  });

  it('initial spawned actor should be immediately available', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {}
      }
    });
    const machine = createMachine<{ actorRef: any }>({
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: () => spawn(childMachine)
          })
        }
      }
    });

    const ChildTest: React.FC<{ actor: Actor<any> }> = ({ actor }) => {
      const [state] = useActor(actor);

      expect(state.value).toEqual('active');

      done();

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);

      return <ChildTest actor={state.context.actorRef} />;
    };

    render(
      <React.StrictMode>
        <Test />
      </React.StrictMode>
    );
  });

  it('spawned actor should be able to receive (deferred) events that it replays when active', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent('FINISH') }
          }
        }
      }
    });
    const machine = createMachine<{ actorRef: any }>({
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: () => spawn(childMachine)
          }),
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest: React.FC<{ actor: Actor<any> }> = ({ actor }) => {
      const [state, send] = useActor(actor);

      expect(state.value).toEqual('active');

      React.useEffect(() => {
        send({ type: 'FINISH' });
      }, []);

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);

      if (state.matches('success')) {
        done();
      }

      return <ChildTest actor={state.context.actorRef} />;
    };

    render(
      <React.StrictMode>
        <Test />
      </React.StrictMode>
    );
  });
});
