import * as React from 'react';
import { useMachineSelect } from '../src/index';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createMachine, assign } from 'xstate';

afterEach(cleanup);

describe('useMachineSelect hook', () => {
  it('should only capture selected parts of the state', () => {
    let rerenders = 0;

    const App = () => {
      const [value, send] = useMachineSelect(
        () =>
          createMachine<{ value: number; flag: boolean }>({
            initial: 'idle',
            context: {
              value: 0,
              flag: true
            },
            states: {
              idle: {
                on: {
                  INC: {
                    actions: assign({
                      value: (ctx) => ctx.value + 1
                    })
                  },
                  TOGGLE: {
                    actions: assign({
                      flag: false as boolean
                    })
                  }
                }
              }
            }
          }),
        (state) => state.context.value * 2
      );

      rerenders++;

      return (
        <>
          <div data-testid="value">{value}</div>
          <button data-testid="inc" onClick={() => send('INC')}></button>
          <button data-testid="toggle" onClick={() => send('TOGGLE')}></button>
        </>
      );
    };

    const { getByTestId } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    const incButton = getByTestId('inc');
    const toggleButton = getByTestId('toggle');
    const valueEl = getByTestId('value');

    expect(valueEl.textContent).toEqual('0');
    fireEvent.click(incButton);
    expect(valueEl.textContent).toEqual('2'); // 1 * 2 = 2

    const currentRerenders = rerenders;
    fireEvent.click(toggleButton);
    expect(rerenders).toEqual(currentRerenders);
  });
});
