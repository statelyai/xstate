/* @jsxImportSource solid-js */
import { useActor, createSpawn } from '../src';
import { render, fireEvent, screen } from 'solid-testing-library';
import { fromTransition } from 'xstate/actors';

describe("usage with core's fromTransition", () => {
  it('should be able to spawn an actor from actor logic', () => {
    const reducer = (state: number, event: { type: 'INC' }): number => {
      if (event.type === 'INC') {
        return state + 1;
      }

      return state;
    };

    const Test = () => {
      const actorRef = createSpawn(fromTransition(reducer, 0));
      const [count, send] = useActor(() => actorRef);

      return (
        <button data-testid="count" onclick={() => send({ type: 'INC' })}>
          {count().context}
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
