import { interpret } from '..';
import { ReducerBehavior, fromReducer } from './reducer';

describe('reducer behavior', () => {
  it('should work', () => {
    const behavior = fromReducer(
      // reducer function
      (state: { count: number }, event: { type: 'inc'; value: number }) => {
        if (event.type === 'inc') {
          return {
            ...state,
            count: state.count + event.value
          };
        }

        // otherwise, return the unchanged state
        return state;
      },

      // initial state
      { count: 0 }
    );

    const actorRef = interpret(behavior);

    actorRef.start();

    actorRef.send({ type: 'inc', value: 1 });
    actorRef.send({ type: 'inc', value: 2 });
    actorRef.send({ type: 'inc', value: 3 });

    expect(actorRef.getSnapshot()).toEqual({ count: 6 });
  });

  it('should work (class)', () => {
    const behavior = new ReducerBehavior(
      // reducer function
      (state: { count: number }, event: { type: 'inc'; value: number }) => {
        if (event.type === 'inc') {
          return {
            ...state,
            count: state.count + event.value
          };
        }

        // otherwise, return the unchanged state
        return state;
      },

      // initial state
      { count: 0 }
    );

    const actorRef = interpret(behavior);

    actorRef.start();

    actorRef.send({ type: 'inc', value: 1 });
    actorRef.send({ type: 'inc', value: 2 });
    actorRef.send({ type: 'inc', value: 3 });

    expect(actorRef.getSnapshot()).toEqual({ count: 6 });
  });
});
