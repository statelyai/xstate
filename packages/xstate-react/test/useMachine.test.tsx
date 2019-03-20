import { assert } from 'chai';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { useMachine } from '../src';
import { Machine } from 'xstate';

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
      loading: {},
      success: {}
    }
  });

  const Fetcher = () => {
    const [current, send] = useMachine(fetchMachine);

    switch (current.value) {
      case 'idle':
        return <button onClick={_ => send('FETCH')}>Fetch</button>;
      case 'loading':
        return <div>Loading...</div>;
      default:
        return <div>Success</div>;
    }
  };

  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  it('should work with the useMachine hook', () => {
    act(() => {
      ReactDOM.render(<Fetcher />, container);
    });
    const button = container.querySelector('button');
    assert.isDefined(button);
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const div = container.querySelector('div');
    assert.equal(div.textContent, 'Loading...');
  });
});
