import * as React from 'react';
import { useMachine, useActor } from '../src';
import { Machine, assign, spawn } from 'xstate';
import { Actor } from 'xstate/lib/Actor';
import { render, wait } from '@testing-library/react';

describe('useActor hook', () => {
  interface TC {
    promise?: Actor<number>;
  }
  const machine = Machine<TC>({
    context: {
      promise: undefined
    },
    initial: 'active',
    states: {
      active: {
        entry: assign({
          promise: () => spawn(Promise.resolve(42))
        })
      }
    }
  });

  const Foo = () => {
    const [state] = useMachine(machine);
    const [msg] = useActor(state.context.promise);

    return <div data-testid="count">{msg}</div>;
  };

  it('should subscribe to the actor', async () => {
    const { getByTestId } = render(<Foo />);

    await wait(undefined, { timeout: 100 });

    expect(getByTestId('count').textContent).toBe('42');
  });
});
