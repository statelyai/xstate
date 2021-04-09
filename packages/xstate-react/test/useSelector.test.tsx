import * as React from 'react';
import { assign, createMachine } from 'xstate';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useInterpret, useSelector } from '../src';

afterEach(cleanup);

describe('useSelector', () => {
  it('only rerenders for selected values', () => {
    const machine = createMachine<{ count: number; other: number }>({
      initial: 'active',
      context: {
        other: 0,
        count: 0
      },
      states: {
        active: {}
      },
      on: {
        OTHER: {
          actions: assign({ other: (ctx) => ctx.other + 1 })
        },
        INCREMENT: {
          actions: assign({ count: (ctx) => ctx.count + 1 })
        }
      }
    });

    let rerenders = 0;

    const App = () => {
      const service = useInterpret(machine);
      const count = useSelector(service, (state) => state.context.count);

      rerenders++;

      return (
        <>
          <div data-testid="count">{count}</div>
          <button
            data-testid="other"
            onClick={() => service.send('OTHER')}
          ></button>
          <button
            data-testid="increment"
            onClick={() => service.send('INCREMENT')}
          ></button>
        </>
      );
    };

    const { getByTestId } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    const countButton = getByTestId('count');
    const otherButton = getByTestId('other');
    const incrementEl = getByTestId('increment');

    fireEvent.click(incrementEl);

    rerenders = 0;

    fireEvent.click(otherButton);
    fireEvent.click(otherButton);
    fireEvent.click(otherButton);
    fireEvent.click(otherButton);

    expect(rerenders).toEqual(0);

    fireEvent.click(incrementEl);

    expect(countButton.textContent).toBe('2');
  });

  it('should work with a custom comparison function', () => {
    const machine = createMachine<{ name: string }>({
      initial: 'active',
      context: {
        name: 'david'
      },
      states: {
        active: {}
      },
      on: {
        CHANGE: {
          actions: assign({ name: (_, e) => e.value })
        }
      }
    });

    const App = () => {
      const service = useInterpret(machine);
      const name = useSelector(
        service,
        (state) => state.context.name,
        (a, b) => a.toUpperCase() === b.toUpperCase()
      );

      return (
        <>
          <div data-testid="name">{name}</div>
          <button
            data-testid="sendUpper"
            onClick={() => service.send({ type: 'CHANGE', value: 'DAVID' })}
          ></button>
          <button
            data-testid="sendOther"
            onClick={() => service.send({ type: 'CHANGE', value: 'other' })}
          ></button>
        </>
      );
    };

    const { getByTestId } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    const nameEl = getByTestId('name');
    const sendUpperButton = getByTestId('sendUpper');
    const sendOtherButton = getByTestId('sendOther');

    expect(nameEl.textContent).toEqual('david');

    fireEvent.click(sendUpperButton);

    // unchanged due to comparison function
    expect(nameEl.textContent).toEqual('david');

    fireEvent.click(sendOtherButton);

    expect(nameEl.textContent).toEqual('other');

    fireEvent.click(sendUpperButton);

    expect(nameEl.textContent).toEqual('DAVID');
  });

  it('should recompute on actor changes ', () => {
    const machine = createMachine<{ count: number; other: number }>({
      initial: 'active',
      context: {
        other: 0,
        count: 0
      },
      states: {
        active: {}
      },
      on: {
        OTHER: {
          actions: assign({ other: (ctx) => ctx.other + 1 })
        },
        INCREMENT: {
          actions: assign({ count: (ctx) => ctx.count + 1 })
        }
      }
    });

    let rerenders = 0;

    const App = () => {
      const service1 = useInterpret(machine);
      const service2 = useInterpret(machine);
      const [service, setService] = React.useState(service1);

      const count = useSelector(
        service,
        React.useCallback(
          (state: typeof service['state']) => state.context.count,
          []
        )
      );

      rerenders++;

      return (
        <>
          <div data-testid="count">{count}</div>
          <button
            data-testid="toggle-service"
            onClick={() => {
              setService((service) =>
                service === service1 ? service2 : service1
              );
            }}
          ></button>
          <button
            data-testid="other"
            onClick={() => service.send('OTHER')}
          ></button>
          <button
            data-testid="increment"
            onClick={() => service.send('INCREMENT')}
          ></button>
        </>
      );
    };

    const { getByTestId } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    const countButton = getByTestId('count');
    const otherButton = getByTestId('other');
    const incrementEl = getByTestId('increment');
    const toggleServiceButton = getByTestId('toggle-service');

    fireEvent.click(incrementEl);

    rerenders = 0;

    fireEvent.click(otherButton);
    fireEvent.click(otherButton);
    fireEvent.click(otherButton);
    fireEvent.click(otherButton);

    expect(rerenders).toEqual(0);

    fireEvent.click(incrementEl);

    expect(countButton.textContent).toBe('2');

    fireEvent.click(toggleServiceButton);

    expect(rerenders).not.toEqual(0);
    expect(countButton.textContent).toBe('0');
  });

  it('honors getSnapshot', () => {
    const machine = createMachine<{ count: number; other: number }>({
      initial: 'active',
      context: {
        other: 0,
        count: 0
      },
      states: {
        active: {}
      },
      on: {
        OTHER: {
          actions: assign({ other: (ctx) => ctx.other + 1 })
        },
        INCREMENT: {
          actions: assign({ count: (ctx) => ctx.count + 1 })
        }
      }
    });

    const App = () => {
      const service = useInterpret(machine);

      const count = useSelector(
        service,
        (count: number) => count,
        (a, b) => a === b,
        // weird snapshot should still be executed
        (service): number => {
          const count = service.status
            ? service.state.context.count
            : service.machine.initialState.context.count;

          return count + 1;
        }
      );

      return <div data-testid="count">{count}</div>;
    };

    const { getByTestId } = render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    const countDiv = getByTestId('count');
    expect(countDiv.textContent).toBe('1');
  });
});
