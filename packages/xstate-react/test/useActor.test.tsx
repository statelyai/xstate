// @ts-nocheck
import { useEffect, useState } from 'react';
import * as React from 'react';
import { useService, useMachine, useActor } from '../src';
import { Machine, assign, interpret, Interpreter } from 'xstate';
import { render, cleanup, fireEvent, act, wait } from '@testing-library/react';
import { fromPromise, fromCallback } from '../src/ActorRef';

afterEach(cleanup);

describe('useActor', () => {
  it('should use an ActorRef (from promise)', async () => {
    const promiseRef = fromPromise(
      new Promise((res) => {
        setTimeout(() => {
          res(42);
        }, 100);
      })
    );

    const Fetcher = () => {
      const [state] = useActor(promiseRef);

      return <div data-testid="result">{state || '--'}</div>;
    };

    const { getByTestId } = render(<Fetcher />);

    expect(getByTestId('result').textContent).toBe('--');

    await wait(() => {
      expect(getByTestId('result').textContent).toBe('42');
    });
  });

  it('should use an ActorRef (from callback)', async () => {
    const callbackRef = fromCallback((emit, receive) => {
      let count = 0;

      const interval = setInterval(() => {
        emit(count++);
      }, 100);

      receive((event) => {
        if (event.type === 'STOP') {
          count = -1;
          emit(count);
        }
      });
    });

    const Counter = () => {
      const [state, send] = useActor(callbackRef);

      return (
        <div
          data-testid="result"
          onClick={() => {
            send({ type: 'STOP' });
          }}
        >
          {state || '--'}
        </div>
      );
    };

    const { getByTestId } = render(<Counter />);

    const resultEl = getByTestId('result');

    expect(resultEl.textContent).toBe('--');

    await wait(() => {
      expect(resultEl.textContent).toBe('1');
    });

    await wait(() => {
      expect(resultEl.textContent).toBe('2');
      fireEvent.click(resultEl);
    });

    await wait(() => {
      expect(resultEl.textContent).toBe('-1');
    });
  });
});
