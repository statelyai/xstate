import * as React from 'react';
import { useMachine } from '../src/fsm';
import { createMachine, assign } from '@xstate/fsm';
import {
  render,
  fireEvent,
  cleanup,
  waitForElement
} from '@testing-library/react';

afterEach(cleanup);

describe('useMachine hook', () => {
  const context = {
    data: undefined
  };
  const fetchMachine = createMachine<typeof context, any>({
    id: 'fetch',
    initial: 'idle',
    context,
    states: {
      idle: {
        on: { FETCH: 'loading' }
      },
      loading: {
        entry: ['load'],
        on: {
          RESOLVE: {
            target: 'success',
            actions: assign({
              data: (_, e) => e.data
            })
          }
        }
      },
      success: {}
    }
  });

  const Fetcher: React.FC<{
    onFetch: () => Promise<any>;
  }> = ({ onFetch = () => new Promise(res => res('some data')) }) => {
    const [current, send] = useMachine(fetchMachine);

    React.useEffect(() => {
      current.actions.forEach(action => {
        if (action.type === 'load') {
          onFetch().then(res => {
            send({ type: 'RESOLVE', data: res });
          });
        }
      });
    }, [current]);

    switch (current.value) {
      case 'idle':
        return <button onClick={_ => send('FETCH')}>Fetch</button>;
      case 'loading':
        return <div>Loading...</div>;
      case 'success':
        return (
          <div>
            Success! Data: <div data-testid="data">{current.context.data}</div>
          </div>
        );
      default:
        return null;
    }
  };

  it('should work with the useMachine hook', async () => {
    const { getByText, getByTestId } = render(
      <Fetcher onFetch={() => new Promise(res => res('fake data'))} />
    );
    const button = getByText('Fetch');
    fireEvent.click(button);
    getByText('Loading...');
    await waitForElement(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('fake data');
  });

  it('should provide the service', () => {
    const Test = () => {
      const [, , service] = useMachine(fetchMachine);

      expect(typeof service.send).toBe('function');

      return null;
    };

    render(<Test />);
  });

  // it('should provide options for the service', () => {
  //   const Test = () => {
  //     const [, , service] = useFSM(fetchMachine);

  //     expect(typeof service.send).toBe('function');

  //     return null;
  //   };

  //   render(<Test />);
  // });

  // it('should merge machine context with options.context', () => {
  //   const testMachine = Machine<{ foo: string; test: boolean }>({
  //     context: {
  //       foo: 'bar',
  //       test: false
  //     },
  //     initial: 'idle',
  //     states: {
  //       idle: {}
  //     }
  //   });

  //   const Test = () => {
  //     const [state] = useMachine(testMachine, { context: { test: true } });

  //     expect(state.context).toEqual({
  //       foo: 'bar',
  //       test: true
  //     });

  //     return null;
  //   };

  //   render(<Test />);
  // });

  // it('actions should not have stale data', async done => {
  //   const toggleMachine = Machine({
  //     initial: 'inactive',
  //     states: {
  //       inactive: {
  //         on: { TOGGLE: 'active' }
  //       },
  //       active: {
  //         entry: 'doAction'
  //       }
  //     }
  //   });

  //   const Toggle = () => {
  //     const [ext, setExt] = useState(false);

  //     const doAction = React.useCallback(() => {
  //       expect(ext).toBeTruthy();
  //       done();
  //     }, [ext]);

  //     const [, send] = useMachine(toggleMachine, {
  //       actions: {
  //         doAction
  //       }
  //     });

  //     return (
  //       <>
  //         <button
  //           data-testid="extbutton"
  //           onClick={_ => {
  //             setExt(true);
  //           }}
  //         />
  //         <button
  //           data-testid="button"
  //           onClick={_ => {
  //             send('TOGGLE');
  //           }}
  //         />
  //       </>
  //     );
  //   };

  //   const { getByTestId } = render(<Toggle />);

  //   const button = getByTestId('button');
  //   const extButton = getByTestId('extbutton');
  //   fireEvent.click(extButton);

  //   fireEvent.click(button);
  // });
});
