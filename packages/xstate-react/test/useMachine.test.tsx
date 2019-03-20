import { assert } from 'chai';
import * as React from 'react';
import { useMachine } from '../src';
import { Machine, assign } from 'xstate';
import {
  render,
  fireEvent,
  cleanup,
  waitForElement
} from 'react-testing-library';

describe('useMachine hook', () => {
  const fetchMachine = Machine({
    id: 'fetch',
    initial: 'idle',
    context: {
      data: undefined
    },
    states: {
      idle: {
        on: { FETCH: 'loading' }
      },
      loading: {
        invoke: {
          src: 'fetchData',
          onDone: {
            target: 'success',
            actions: assign({
              data: (_, e) => e.data
            })
          }
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  const Fetcher = () => {
    const [current, send] = useMachine(
      Fetcher.machine.withConfig({
        services: {
          fetchData: () => new Promise(res => res('some data')),
          ...Fetcher.machine.options.services
        }
      })
    );

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

  Fetcher.machine = fetchMachine;

  afterEach(cleanup);

  it('should work with the useMachine hook', async () => {
    Fetcher.machine = fetchMachine.withConfig({
      services: {
        fetchData: () => new Promise(res => res('fake data'))
      }
    });

    const { getByText, getByTestId } = render(<Fetcher />);
    const button = getByText('Fetch');
    fireEvent.click(button);
    getByText('Loading...');
    await waitForElement(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    assert.equal(dataEl.textContent, 'fake data');
  });
});
