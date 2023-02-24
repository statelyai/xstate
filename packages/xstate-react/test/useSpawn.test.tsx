import { fireEvent, screen } from '@testing-library/react';
import { fromReducer } from 'xstate/actors';
import { useActor, useSpawn } from '../src/index.js';
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
