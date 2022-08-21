/* @jsxImportSource solid-js */
import { useService, useMachine } from '../src/fsm';
import { createMachine, assign, interpret, StateMachine } from '@xstate/fsm';
import { render, fireEvent, screen } from 'solid-testing-library';
import { Accessor, Component, createEffect, createSignal, on } from 'solid-js';

afterEach(() => jest.clearAllMocks());

describe('useService hook for fsm', () => {
  const counterMachine = createMachine<{ count: number }>({
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

  const counterMachine2 = createMachine<{
    subCount: { subCount1: { subCount2: { count: number } } };
  }>({
    id: 'counter2',
    initial: 'active',
    context: { subCount: { subCount1: { subCount2: { count: 0 } } } },
    states: {
      active: {
        on: {
          INC: {
            actions: assign({
              subCount: (ctx) => ({
                ...ctx.subCount,
                subCount1: {
                  ...ctx.subCount.subCount1,
                  subCount2: {
                    ...ctx.subCount.subCount1.subCount2,
                    count: ctx.subCount.subCount1.subCount2.count + 1
                  }
                }
              })
            })
          },
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

    counterService.send({ type: 'INC' });

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('1');
    });
  });

  it('service should be updated when it changes shallow', () => {
    const counterService1 = interpret(counterMachine).start();
    const counterService2 = interpret(counterMachine).start();

    const Counter = (props: {
      counterRef:
        | Accessor<typeof counterService1>
        | Accessor<typeof counterService2>;
    }) => {
      const [state, send] = useService(props.counterRef);

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
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
            onclick={() => setService(counterService2)}
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

  it('service should be updated when it changes deep', () => {
    const counterService1 = interpret(counterMachine2).start();
    const counterService2 = interpret(counterMachine2).start();

    const Counter: Component<{
      counterRef: Accessor<StateMachine.Service<any, any>>;
    }> = (props) => {
      const [state, send] = useService(props.counterRef);

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
          <div data-testid="count">
            {state.context.subCount.subCount1.subCount2.count}
          </div>
        </div>
      );
    };
    const CounterParent = () => {
      const [service, setService] = createSignal(counterService1);

      return (
        <div>
          <button
            data-testid="change-service"
            onclick={() => setService(counterService2)}
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
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
  });

  it('service should be able to be used from useMachine', () => {
    const CounterDisplay: Component<{
      service: StateMachine.Service<any, any>;
    }> = (props) => {
      const [state] = useService(props.service);

      return <div data-testid="count">{state.context.count}</div>;
    };

    const Counter = () => {
      const [, send, service] = useMachine(counterMachine);

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
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

  it('service state should only trigger effect of directly tracked value', () => {
    const Counter = () => {
      const counterService = interpret(counterMachine2).start();
      const [state, send] = useService(counterService);
      const [effectCount, setEffectCount] = createSignal(0);
      createEffect(
        on(
          () => state.context.subCount.subCount1,
          () => {
            setEffectCount((prev) => prev + 1);
          },
          {
            defer: true
          }
        )
      );
      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
          <div data-testid="effect-count">{effectCount()}</div>
          <div data-testid="count">
            {state.context.subCount.subCount1.subCount2.count}
          </div>
        </div>
      );
    };

    render(() => <Counter />);

    const incButton = screen.getByTestId('inc');
    const countEl = screen.getByTestId('count');
    const effectCountEl = screen.getByTestId('effect-count');

    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
    expect(effectCountEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('2');
    expect(effectCountEl.textContent).toBe('0');
  });
});
