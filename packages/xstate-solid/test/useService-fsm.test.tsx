/* @jsxImportSource solid-js */
import { useService, useMachine } from '../src/fsm';
import { createMachine, assign, interpret, StateMachine } from '@xstate/fsm';
import { render, fireEvent, screen } from 'solid-testing-library';
import { Component, createSignal } from 'solid-js';

describe('useService hook for fsm', () => {
  const counterMachine = () => createMachine<{ count: number }>({
    id: 'counter',
    initial: 'active',
    context: { count: 0 },
    states: {
      active: {
        on: {
          INC: { actions: assign({ count: (ctx) => ctx.count + 1 }) },
          SOMETHING: { actions: 'doSomething' }
        }
      }
    }
  });

  it('should share a single service instance', () => {
    const counterService = interpret(counterMachine()).start();

    const Counter = () => {
      const [state] = useService(() => counterService);

      return <div data-testid="count">{state.context.count}</div>;
    };

    render(() => (
      <div>
        <Counter />
        <Counter />
      </div>
    ));

    const countEls = screen.getAllByTestId('count');

    expect(countEls.length).toBe(2);

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('0');
    });

    counterService.send('INC');

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('1');
    });
  });

  it('service should be updated when it changes', () => {
    const counterService1 = interpret(counterMachine()).start();
    const counterService2 = interpret(counterMachine()).start();

    const Counter = (props) => {
      const [state, send] = useService(
        props.counterRef
      );

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send('INC')} />
          <div data-testid="count">{state.context.count}</div>
        </div>
      );
    };
    const CounterParent = () => {
      const [service, setService] = createSignal(counterService1);

      return (
        <div>
          <button
            data-testid="change-service"
            onclick={() => setService(() => counterService2)}
          />
          <Counter counterRef={service} />
        </div>
      );
    };

    render(() => <CounterParent />);

    const changeServiceButton = screen.getByTestId('change-service');
    const incButton = screen.getByTestId('inc');
    const countEl = screen.getByTestId('count');

    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
    fireEvent.click(changeServiceButton);
    expect(countEl.textContent).toBe('0');
  });

  it('service should be able to be used from useMachine', () => {
    const CounterDisplay: Component<{
      service: StateMachine.Service<any, any>;
    }> = (props) => {
      const [state] = useService(() => props.service);

      return <div data-testid="count">{state.context.count}</div>;
    };

    const Counter = () => {
      const [, send, service] = useMachine(counterMachine());

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send('INC')} />
          <CounterDisplay service={service} />
        </div>
      );
    };

    render(() => <Counter />);

    const incButton = screen.getByTestId('inc');
    const countEl = screen.getByTestId('count');

    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
  });

  it('service should warn when reusing the same machine instance - reusing will result in shared context', () => {
    // tslint:disable-next-line:no-console
    const warn = jest.spyOn(console, "warn").mockImplementation(message => console.log(message));
    const sameMachine = counterMachine();
    const counterService1 = interpret(sameMachine).start();
    const counterService2 = interpret(sameMachine).start();

    const Counter = (props) => {
      const [state, send] = useService(
        props.counterRef
      );

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send('INC')} />
          <div data-testid="count">{state.context.count}</div>
        </div>
      );
    };
    const CounterParent = () => {
      const [service, setService] = createSignal(counterService1);

      return (
        <div>
          <button
            data-testid="change-service"
            onclick={() => setService(() => counterService2)}
          />
          <Counter counterRef={service} />
        </div>
      );
    };

    render(() => <CounterParent />);

    const changeServiceButton = screen.getByTestId('change-service');
    const incButton = screen.getByTestId('inc');
    const countEl = screen.getByTestId('count');

    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
    fireEvent.click(changeServiceButton);
    expect(countEl.textContent).toBe('1');
    expect(warn).toBeCalled();
    warn.mockRestore();
  });

});
