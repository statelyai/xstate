/* @jsxImportSource solid-js */
import { useActor, createSpawn } from '../src';
import { render, fireEvent, screen } from 'solid-testing-library';
import { fromReducer } from 'xstate/actors';

describe("usage with core's spawnBehavior", () => {
  it('should be able to spawn an actor from a behavior', () => {
    const reducer = (state: number, event: { type: 'INC' }): number => {
      if (event.type === 'INC') {
        return state + 1;
      }

      return state;
    };

    const Test = () => {
      const actorRef = createSpawn(fromReducer(reducer, 0));
      const [count, send] = useActor(() => actorRef);

      return (
        <button data-testid="count" onclick={() => send({ type: 'INC' })}>
          {count()}
        </button>
      );
    };

    render(() => <Test />);
    const button = screen.getByTestId('count');

    expect(button.textContent).toEqual('0');

    fireEvent.click(button);

    expect(button.textContent).toEqual('1');
  });
});
