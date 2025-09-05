import { render } from '@testing-library/react';
import { ActorRefFrom, assign, next_createMachine, setup } from 'xstate';
import {
  useActor,
  useActorRef,
  useMachine,
  useSelector
} from '../src/index.ts';
import z from 'zod';

describe('useMachine', () => {
  interface YesNoContext {
    value?: number;
  }

  interface YesNoEvent {
    type: 'YES';
  }

  const yesNoMachine = next_createMachine({
    // types: {} as { context: YesNoContext; events: YesNoEvent },
    schemas: {
      context: z.object({
        value: z.number().optional()
      }),
      events: z.object({
        type: z.literal('YES')
      })
    },
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
    const child = next_createMachine({
      // types: {} as {
      //   context: { bar: number };
      //   events: { type: 'FOO'; data: number };
      // },
      schemas: {
        context: z.object({
          bar: z.number()
        }),
        events: z.object({
          type: z.literal('FOO'),
          data: z.number()
        })
      },
      id: 'myActor',
      context: {
        bar: 1
      },
      initial: 'ready',
      states: {
        ready: {}
      }
    });

    const m = next_createMachine({
      initial: 'ready',
      schemas: {
        context: z.object({
          actor: z.custom<ActorRefFrom<typeof child>>().nullable()
        })
      },
      context: {
        actor: null
      },
      states: {
        ready: {
          entry: (_, enq) => ({
            context: {
              actor: enq.spawn(child)
            }
          })
        }
      }
    });

    interface Props {
      myActor: ActorRefFrom<typeof child>;
    }

    function Element({ myActor }: Props) {
      const current = useSelector(myActor, (state) => state);
      const bar: number = current.context.bar;

      // @ts-expect-error
      send({ type: 'WHATEVER' });

      return (
        <>
          {bar}
          <div onClick={() => myActor.send({ type: 'FOO', data: 1 })}>
            click
          </div>
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

describe('useActor', () => {
  it('should require input to be specified when defined', () => {
    const withInputMachine = next_createMachine({
      // types: {} as { input: { value: number } },
      schemas: {
        input: z.object({
          value: z.number()
        })
      },
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    const Component = () => {
      // @ts-expect-error
      const _ = useActor(withInputMachine);
      return <></>;
    };

    render(<Component />);
  });

  it('should not require input when not defined', () => {
    const noInputMachine = next_createMachine({
      // types: {} as {},
      initial: 'idle',
      states: {
        idle: {}
      }
    });
    const Component = () => {
      const _ = useActor(noInputMachine);
      return <></>;
    };

    render(<Component />);
  });
});

describe('useActorRef', () => {
  it('should require input to be specified when defined', () => {
    const withInputMachine = next_createMachine({
      // types: {} as { input: { value: number } },
      schemas: {
        input: z.object({
          value: z.number()
        })
      },
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    const Component = () => {
      // @ts-expect-error
      const _ = useActorRef(withInputMachine);
      return <></>;
    };

    render(<Component />);
  });

  it('should not require input when not defined', () => {
    const noInputMachine = next_createMachine({
      // types: {} as {},
      initial: 'idle',
      states: {
        idle: {}
      }
    });

    const Component = () => {
      const _ = useActorRef(noInputMachine);
      return <></>;
    };

    render(<Component />);
  });
});

it('useMachine types work for machines with a specified id and state with an after property #5008', () => {
  // https://github.com/statelyai/xstate/issues/5008
  const cheatCodeMachine = next_createMachine({
    id: 'cheatCodeMachine',
    initial: 'disabled',
    states: {
      disabled: {
        after: {}
      },
      enabled: {}
    }
  });

  function _useCheatCode(): boolean {
    // This should typecheck without errors
    const [state] = useMachine(cheatCodeMachine);

    return state.matches('enabled');
  }
});
