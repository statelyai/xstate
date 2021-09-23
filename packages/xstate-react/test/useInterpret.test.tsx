import * as React from 'react';
import { createMachine } from 'xstate';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useInterpret, useSelector } from '../src';

afterEach(cleanup);

describe('useInterpret', () => {
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

    const { getByTestId } = render(<App />);
    const button = getByTestId('button');

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

    rerender(<App value={42} />);

    expect(actual).toEqual([1, 42]);
  });

  describe('syncToContext', () => {
    it('Should initialise the context as the synced context', (done) => {
      const machine = createMachine({
        context: {
          id: ''
        }
      });

      const App = (props) => {
        const service = useInterpret(machine, {
          syncToContext: {
            id: props.id
          }
        });

        React.useEffect(() => {
          expect(service.state.context.id).toEqual(props.id);
          done();
        }, [service, props.id]);

        return null;
      };

      render(<App id="id" />);
    });

    it('Should react to updates to its synced context', () => {
      const machine = createMachine({
        context: {
          id: ''
        }
      });

      const getId = (state) => state.context.id;

      const App = (props) => {
        const service = useInterpret(machine, {
          syncToContext: {
            id: props.id
          }
        });

        const id = useSelector(service, getId);

        return <div data-testid="result">{id}</div>;
      };

      const screen = render(<App id="id" />);

      expect(screen.getByTestId('result').innerHTML).toEqual('id');

      screen.rerender(<App id="id2" />);

      expect(screen.getByTestId('result').innerHTML).toEqual('id2');
    });
  });
});
