import { useState } from 'react';
import * as React from 'react';
import { useService, useMachine } from '../src/fsm';
import { createMachine, assign, interpret, StateMachine } from '@xstate/fsm';
import { fireEvent, act, screen } from '@testing-library/react';
import { describeEachReactMode } from './utils';

describeEachReactMode('useService, fsm (%s)', ({ render }) => {
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

  it('should share a single service instance', () => {
    const counterService = interpret(counterMachine).start();

    const Counter = () => {
      const [state] = useService(counterService);

      return <div data-testid="count">{state.context.count}</div>;
    };

    render(
      <>
        <Counter />
        <Counter />
      </>
    );

    const countEls = screen.getAllByTestId('count');

    expect(countEls.length).toBe(2);

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('0');
    });

    act(() => {
      counterService.send('INC');
    });

    countEls.forEach((countEl) => {
      expect(countEl.textContent).toBe('1');
    });
  });

  it('service should be updated when it changes', () => {
    const counterService1 = interpret(counterMachine).start();
    const counterService2 = interpret(counterMachine).start();

    const Counter = ({
      counterRef
    }: {
      counterRef: typeof counterService1;
    }) => {
      const [state, send] = useService(counterRef);

      return (
        <>
          <button data-testid="inc" onClick={(_) => send('INC')} />
          <div data-testid="count">{state.context.count}</div>
        </>
      );
    };
    const CounterParent = () => {
      const [service, setService] = useState(counterService1);

      return (
        <>
          <button
            data-testid="change-service"
            onClick={() => setService(counterService2)}
          />
          <Counter counterRef={service} />
        </>
      );
    };

    render(<CounterParent />);

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
    const CounterDisplay: React.FC<{
      service: StateMachine.Service<any, any>;
    }> = ({ service }) => {
      const [state] = useService(service);

      return <div data-testid="count">{state.context.count}</div>;
    };

    const Counter = () => {
      const [, send, service] = useMachine(counterMachine);

      return (
        <>
          <button data-testid="inc" onClick={(_) => send('INC')} />
          <CounterDisplay service={service} />
        </>
      );
    };

    render(<Counter />);

    const incButton = screen.getByTestId('inc');
    const countEl = screen.getByTestId('count');

    expect(countEl.textContent).toBe('0');
    fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');
  });
});
