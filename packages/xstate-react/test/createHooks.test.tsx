import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMachine, interpret } from 'xstate';
import { createHooks } from '../src/createHooks';

describe('createHooks', () => {
  it('.useActor() returns [state, send], just like useActor(actorRef)', async () => {
    const machine = createMachine({
      initial: 'loading',
      states: {
        loading: {
          on: {
            FULFILL: 'success'
          }
        },
        success: {}
      }
    });

    const service = interpret(machine).start();

    const hooks = createHooks(service);

    const Component = () => {
      const [state, send] = hooks.useActor();

      return (
        <>
          <div data-testid="state">{state.value}</div>
          <button data-testid="button" onClick={() => send('FULFILL')}></button>
        </>
      );
    };

    render(<Component />);

    const state = await screen.findByTestId('state');
    const button = await screen.findByTestId('button');

    expect(state.textContent).toEqual('loading');

    fireEvent.click(button);

    expect(state.textContent).toEqual('success');
  });

  it('.actorRef returns the actor ref', () => {
    const machine = createMachine({});

    const service = interpret(machine).start();

    const hooks = createHooks(service);

    expect(hooks.actorRef).toBe(service);
  });

  it('.useSelector(selector) selects a value, just like useSelector(actorRef, selector)', async () => {
    const machine = createMachine({
      context: {
        numbers: [1, 2, 3]
      }
    });

    const service = interpret(machine).start();

    const hooks = createHooks(service);

    const Component = () => {
      const sum = hooks.useSelector((state) =>
        state.context.numbers.reduce((acc, val) => acc + val, 0)
      );

      return <div data-testid="sum">{sum}</div>;
    };

    render(<Component />);

    const sum = await screen.findByTestId('sum');

    expect(sum.textContent).toEqual('6');
  });

  it('should share the same actor reference', async () => {
    const machine = createMachine({
      initial: 'loading',
      states: {
        loading: {
          on: {
            FULFILL: 'success'
          }
        },
        success: {}
      }
    });

    const service = interpret(machine).start();

    const hooks = createHooks(service);

    const Output = () => {
      const stateValue = hooks.useSelector((state) => state.value);

      return <div data-testid="output">{stateValue}</div>;
    };

    const Button = () => {
      const { actorRef } = hooks;

      return (
        <>
          <Output />
          <button
            data-testid="button"
            onClick={() => actorRef.send('FULFILL')}
          ></button>
        </>
      );
    };

    render(
      <>
        <Button />
        <Output />
      </>
    );

    const outputs = await screen.findAllByTestId('output');
    const button = await screen.findByTestId('button');

    expect(outputs.map((output) => output.textContent)).toEqual([
      'loading',
      'loading'
    ]);

    fireEvent.click(button);

    expect(outputs.map((output) => output.textContent)).toEqual([
      'success',
      'success'
    ]);
  });

  it('.Provider should override the default value for its subtree', async () => {
    const machine = createMachine({
      context: {
        count: 42
      }
    });

    const service = interpret(machine).start();

    const otherService = interpret(
      machine.withContext({ count: 9001 })
    ).start();

    const hooks = createHooks(service);

    const Component = () => {
      const count = hooks.useSelector((state) => state.context.count);

      return <div data-testid="count">{count}</div>;
    };

    render(
      <>
        <Component />
        <hooks.Provider value={otherService}>
          <Component />
        </hooks.Provider>
      </>
    );

    const counts = await screen.findAllByTestId('count');

    expect(counts.map((count) => count.textContent)).toEqual(['42', '9001']);
  });
});
