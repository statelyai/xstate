import { fireEvent, screen } from '@testing-library/react';
import * as React from 'react';
import { fromReducer, fromPromise } from 'xstate/lib/behaviors';
import { useActor, useSpawn } from '../src';
import { describeEachReactMode } from './utils';

describeEachReactMode('useSpawn (%s)', ({ render }) => {
  it('should be able to spawn an actor from a behavior', () => {
    const reducer = (state: number, event: { type: 'INC' }): number => {
      if (event.type === 'INC') {
        return state + 1;
      }

      return state;
    };

    const behavior = fromReducer(reducer, 0);

    const Test = () => {
      const actorRef = useSpawn(behavior);
      const [count, send] = useActor(actorRef);

      return (
        <>
          <button data-testid="count" onClick={() => send({ type: 'INC' })}>
            {count}
          </button>
        </>
      );
    };

    render(<Test />);
    const button = screen.getByTestId('count');

    expect(button.textContent).toEqual('0');

    fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });
});

describeEachReactMode('useSpawn (%s) with options', ({ render }) => {
  it('should be able to spawn an actor from a behavior with options', () => {
    const bahavior = fromPromise(() => Promise.resolve(1));

    const Test = () => {
      const actor = useSpawn(bahavior, {
        id: 'optionID'
      });

      return (
        <>
          <div data-testid="actor-id">{actor.id}</div>
        </>
      );
    };

    render(<Test />);
    const tag = screen.getByTestId('actor-id');
    expect(tag.textContent).toEqual('optionID');
  });
});
