import { of } from 'rxjs';
import {
  assign,
  createMachine,
  fromObservable,
  fromPromise,
  fromTransition,
  setup
} from '../src';

describe('setup()', () => {
  it('can strongly type provided actors', () => {
    const promiseSrc = fromPromise(() => Promise.resolve('hello'));
    const transitionSrc = fromTransition(() => 'world', 'hello');
    const observableSrc = fromObservable(() => of(42));
    const machineSrc = createMachine({});

    const p = setup({
      actors: {
        promiseSrc,
        transitionSrc,
        observableSrc,
        machineSrc
      }
    });

    p.createMachine({
      types: {
        context: {} as {
          data: unknown;
        }
      },
      context: {
        data: null
      },
      invoke: [
        {
          src: 'promiseSrc',
          onDone: {
            actions: assign({
              data: ({ event }) => {
                event.output satisfies string;

                // @ts-expect-error
                event.output satisfies number;

                return event.output;
              }
            })
          }
        },
        {
          src: 'transitionSrc',
          onSnapshot: {
            actions: assign({
              data: ({ event }) => {
                event.snapshot.context satisfies string;

                // @ts-expect-error
                event.snapshot.context satisfies number;

                return event.snapshot.context;
              }
            })
          }
        },
        {
          src: 'observableSrc',
          onSnapshot: {
            actions: assign({
              data: ({ event }) => {
                event.snapshot.context satisfies number | undefined;

                // @ts-expect-error
                event.snapshot.context satisfies string;

                return event.snapshot.context;
              }
            })
          }
        }
      ]
    });
  });

  it('can strongly type provided actions', () => {
    const p = setup({
      actions: {
        greet: ({ params }: { params: { name: string } }) => {
          console.log(`Hello, ${params.name}!`);
        }
      }
    });

    p.createMachine({
      entry: {
        type: 'greet',
        params: {
          name: 'some name'
        }
      },
      exit: [
        {
          type: 'greet',
          params: {
            // @ts-expect-error
            name: 42
          }
        },
        {
          // @ts-expect-error
          type: 'other'
        },
        // @ts-expect-error
        'greet'
      ]
    });
  });
});
