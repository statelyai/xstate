import { render } from '@testing-library/react';
import * as React from 'react';
import { ActorRefFrom, assign, createMachine } from 'xstate';
import { useActor, useMachine } from '../src/index.js';

describe('useMachine', () => {
  interface YesNoContext {
    value?: number;
  }

  interface YesNoEvent {
    type: 'YES';
  }

  const yesNoMachine = createMachine<YesNoContext, YesNoEvent>({
    context: {
      value: undefined
    },
    initial: 'no',
    states: {
      no: {
        on: {
          YES: 'yes'
        }
      },
      yes: {
        type: 'final'
      }
    }
  });

  it('state should not become never after checking state with matches', () => {
    const YesNo = () => {
      const [state] = useMachine(yesNoMachine);

      if (state.matches('no')) {
        return <span>No</span>;
      }

      return <span>Yes: {state.context.value}</span>;
    };

    render(<YesNo />);
  });

  // Example from: https://github.com/statelyai/xstate/discussions/1534
  it('spawned actors should be typed correctly', () => {
    const child = createMachine<{ bar: number }, { type: 'FOO'; data: number }>(
      {
        id: 'myActor',
        context: {
          bar: 1
        },
        initial: 'ready',
        states: {
          ready: {}
        }
      }
    );

    const m = createMachine(
      {
        initial: 'ready',
        context: {
          actor: null
        } as { actor: ActorRefFrom<typeof child> | null },
        states: {
          ready: {
            entry: 'spawnActor'
          }
        }
      },
      {
        actions: {
          spawnActor: assign({
            actor: (_, __, { spawn }) => spawn(child)
          })
        }
      }
    );

    interface Props {
      myActor: ActorRefFrom<typeof child>;
    }

    function Element({ myActor }: Props) {
      const [current, send] = useActor(myActor);
      const bar: number = current.context.bar;

      // @ts-expect-error
      send({ type: 'WHATEVER' });

      return (
        <>
          {bar}
          <div onClick={() => send({ type: 'FOO', data: 1 })}>click</div>
        </>
      );
    }

    function App() {
      const [current] = useMachine(m);

      if (!current.context.actor) {
        return null;
      }

      return <Element myActor={current.context.actor} />;
    }

    const noop = (_val: any) => {
      /* ... */
    };

    noop(App);
  });
});
