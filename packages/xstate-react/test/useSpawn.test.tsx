import * as React from 'react';
import { useActor, useSpawn } from '../src';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { fromReducer } from 'xstate/behaviors';

afterEach(cleanup);

describe('useSpawn', () => {
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

    const { getByTestId } = render(
      <React.StrictMode>
        <Test />
      </React.StrictMode>
    );
    const button = getByTestId('count');

    expect(button.textContent).toEqual('0');

    fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });
});
