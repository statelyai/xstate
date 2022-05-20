import * as React from 'react';
import { createMachine } from 'xstate';
import { fireEvent, screen } from '@testing-library/react';
import { useInterpret, useMachine } from '../src';
import { describeEachReactMode } from './utils';

const originalConsoleWarn = console.warn;

afterEach(() => {
  console.warn = originalConsoleWarn;
});

describeEachReactMode('useInterpret (%s)', ({ suiteKey, render }) => {
  it('observer should be called with initial state', (done) => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            ACTIVATE: 'active'
          }
        },
        active: {}
      }
    });

    const App = () => {
      const service = useInterpret(machine);

      React.useEffect(() => {
        service.subscribe((state) => {
          expect(state.matches('inactive')).toBeTruthy();
          done();
        });
      }, [service]);

      return null;
    };

    render(<App />);
  });

  it('observer should be called with next state', (done) => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            ACTIVATE: 'active'
          }
        },
        active: {}
      }
    });

    const App = () => {
      const service = useInterpret(machine);

      React.useEffect(() => {
        service.subscribe((state) => {
          if (state.matches('active')) {
            done();
          }
        });
      }, [service]);

      return (
        <button
          data-testid="button"
          onClick={() => {
            service.send('ACTIVATE');
          }}
        ></button>
      );
    };

    render(<App />);
    const button = screen.getByTestId('button');

    fireEvent.click(button);
  });

  it('actions created by a layout effect should access the latest closure values', () => {
    const actual: number[] = [];

    const machine = createMachine({
      initial: 'foo',
      states: {
        foo: {
          on: {
            EXEC_ACTION: {
              actions: 'recordProp'
            }
          }
        }
      }
    });

    const App = ({ value }: { value: number }) => {
      const service = useInterpret(machine, {
        actions: {
          recordProp: () => actual.push(value)
        }
      });

      React.useLayoutEffect(() => {
        service.send('EXEC_ACTION');
      });

      return null;
    };

    const { rerender } = render(<App value={1} />);

    expect(actual).toEqual(suiteKey === 'strict' ? [1, 1] : [1]);

    actual.length = 0;
    rerender(<App value={42} />);

    expect(actual).toEqual([42]);
  });

  it('should warn when machine reference is updated during the hook lifecycle', () => {
    console.warn = jest.fn();
    const machine = createMachine({
      initial: 'foo',
      context: { id: 1 },
      states: {
        foo: {
          on: {
            CHECK: {
              target: 'bar',
              guard: 'hasOverflown'
            }
          }
        },
        bar: {}
      }
    });
    const App = () => {
      const [id, setId] = React.useState(1);
      const [, send] = useMachine(
        machine.provide({
          guards: {
            hasOverflown: () => id > 1
          }
        })
      );

      return (
        <>
          <button
            onClick={() => {
              setId(2);
              send('CHECK');
            }}
          >
            update id
          </button>
        </>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(console.warn).toHaveBeenCalledTimes(suiteKey === 'strict' ? 4 : 1);
    expect((console.warn as jest.Mock).mock.calls[0][0]).toMatchInlineSnapshot(`
      "Machine given to \`useMachine\` has changed between renders. This is not supported and might lead to unexpected results.
      Please make sure that you pass the same Machine as argument each time."
    `);
    if (suiteKey === 'strict') {
      expect((console.warn as jest.Mock).mock.calls[1][0])
        .toMatchInlineSnapshot(`
        "Machine given to \`useMachine\` has changed between renders. This is not supported and might lead to unexpected results.
        Please make sure that you pass the same Machine as argument each time."
      `);
      expect((console.warn as jest.Mock).mock.calls[2][0])
        .toMatchInlineSnapshot(`
        "Machine given to \`useMachine\` has changed between renders. This is not supported and might lead to unexpected results.
        Please make sure that you pass the same Machine as argument each time."
      `);
      expect((console.warn as jest.Mock).mock.calls[3][0])
        .toMatchInlineSnapshot(`
        "Machine given to \`useMachine\` has changed between renders. This is not supported and might lead to unexpected results.
        Please make sure that you pass the same Machine as argument each time."
      `);
    }
  });
});
