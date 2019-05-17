import { assert } from 'chai';
import { useEffect, useState } from 'react';
import * as React from 'react';
import { useService } from '../src';
import { Machine, assign, interpret } from 'xstate';
import { render, cleanup, fireEvent } from 'react-testing-library';
// import { doneInvoke } from '../../../lib/actions';

afterEach(cleanup);

describe('useService hook', () => {
  const counterMachine = Machine({
    id: 'counter',
    initial: 'active',
    context: { count: 0 },
    states: {
      active: {
        on: {
          INC: { actions: assign({ count: ctx => ctx.count + 1 }) },
          SOMETHING: { actions: 'doSomething' }
        }
      }
    }
  });

  it('should share a single service instance', () => {
    const counterService = interpret(counterMachine).start();

    const Counter = () => {
      const [state] = useService(counterService);

      return <div data-testid="count">{state.context.count}</div>;
    };

    const { getAllByTestId } = render(
      <>
        <Counter />
        <Counter />
      </>
    );

    const countEls = getAllByTestId('count');

    assert.lengthOf(countEls, 2);

    countEls.forEach(countEl => {
      assert.equal(countEl.textContent, '0');
    });

    counterService.send('INC');

    countEls.forEach(countEl => {
      assert.equal(countEl.textContent, '1');
    });
  });

  it('service actions should be configurable', () => {
    const counterService = interpret(counterMachine).start();

    const Counter = () => {
      const [state, send] = useService(counterService);
      const [otherState, setOtherState] = useState('');

      useEffect(
        () => {
          counterService.execute(state, {
            doSomething: () => setOtherState('test')
          });
        },
        [state]
      );

      return (
        <>
          <button data-testid="button" onClick={_ => send('SOMETHING')} />
          <div data-testid="count">{state.context.count}</div>
          <div data-testid="other">{otherState}</div>
        </>
      );
    };

    const { getAllByTestId } = render(
      <>
        <Counter />
        <Counter />
      </>
    );

    const countEls = getAllByTestId('count');
    const buttonEls = getAllByTestId('button');

    assert.lengthOf(countEls, 2);

    countEls.forEach(countEl => {
      assert.equal(countEl.textContent, '0');
    });

    buttonEls.forEach(buttonEl => {
      fireEvent.click(buttonEl);
    });

    const otherEls = getAllByTestId('other');

    otherEls.forEach(otherEl => {
      assert.equal(otherEl.textContent, 'test');
    });
  });
});
