import { of } from 'rxjs';
import {
  assign,
  createMachine,
  fromObservable,
  fromPromise,
  fromTransition
} from '../src';
import { provide } from '../src/provide';

describe('provide()', () => {
  it('can strongly type provided actors', () => {
    const promiseSrc = fromPromise(() => Promise.resolve('hello'));
    const transitionSrc = fromTransition(() => 'world', 'hello');
    const observableSrc = fromObservable(() => of(42));
    const machineSrc = createMachine({});

    const p = provide({
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
});
