import {
  createActor,
  createMachine,
  initialTransition,
  transition,
  type EnqueueObject,
  type EventObject
} from '../src/index.ts';

describe.each(['actor', 'pure'] as const)(
  'snapshot context through %s transitions',
  (mode) => {
    it.each(['one argument', 'two arguments'])(
      'preserves previous snapshots when entry with %s returns a context patch',
      (shape) => {
        const updateContext = ({
          context
        }: {
          context: { count: number };
        }) => ({
          context: { count: context.count + 1 }
        });
        const machine = createMachine({
          context: { count: 0, retained: true },
          initial: 'a',
          states: {
            a: { on: { next: { target: 'b' } } },
            b: {
              entry:
                shape === 'one argument'
                  ? updateContext
                  : (
                      args: Parameters<typeof updateContext>[0],
                      _enqueue: EnqueueObject<EventObject, EventObject>
                    ) => updateContext(args)
            }
          }
        });
        const actor = createActor(machine).start();
        const previous =
          mode === 'actor'
            ? actor.getSnapshot()
            : initialTransition(machine)[0];
        const previousContext = previous.context;
        let next = previous;

        if (mode === 'actor') {
          actor.send({ type: 'next' });
          next = actor.getSnapshot();
        } else {
          [next] = transition(machine, previous, { type: 'next' });
        }

        expect(next.value).toBe('b');
        expect(next.context).toEqual({ count: 1, retained: true });
        expect(previous.value).toBe('a');
        expect(previous.context).toEqual({ count: 0, retained: true });
        expect(previous.context).toBe(previousContext);
        expect(next.context).not.toBe(previousContext);
      }
    );

    it('preserves previous snapshots when a default initial transition returns a context patch', () => {
      const machine = createMachine({
        context: { count: 0, retained: true },
        initial: 'a',
        states: {
          a: { on: { next: { target: 'parent' } } },
          parent: {
            initial: 'child',
            states: { child: {} }
          }
        }
      });
      machine.states.parent.initial.to = ({ context }) => ({
        context: { count: context.count + 1 }
      });
      const actor = createActor(machine).start();
      const previous =
        mode === 'actor' ? actor.getSnapshot() : initialTransition(machine)[0];
      const previousContext = previous.context;
      let next = previous;

      if (mode === 'actor') {
        actor.send({ type: 'next' });
        next = actor.getSnapshot();
      } else {
        [next] = transition(machine, previous, { type: 'next' });
      }

      expect(next.value).toEqual({ parent: 'child' });
      expect(next.context).toEqual({ count: 1, retained: true });
      expect(previous.value).toBe('a');
      expect(previous.context).toEqual({ count: 0, retained: true });
      expect(previous.context).toBe(previousContext);
      expect(next.context).not.toBe(previousContext);
    });
  }
);
