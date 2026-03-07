/* @jsxImportSource solid-js */
import { createMemo, createSignal, from } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import {
  ActorRefFrom,
  AnyMachineSnapshot,
  StateFrom,
  createMachine
} from 'xstate';
import { useActorRef, useMachine, fromActorRef } from '../src/index.ts';
describe('usage of selectors with reactive service state', () => {
  // TODO: rewrite this test to not use `from()`
  it.skip('only rerenders for selected values', () => {
    const machine = createMachine({
      initial: 'active',
      context: {
        other: 0,
        count: 0
      } as any,
      states: {
        active: {}
      },
      on: {
        OTHER: ({ context }) => ({
          context: { ...context, other: context.other + 1 }
        }),
        INCREMENT: ({ context }) => ({
          context: { ...context, count: context.count + 1 }
        })
      }
    });

    let rerenders = 0;

    const App = () => {
      const service = useActorRef(machine);
      const serviceState = from(service);

      const selector = (state: StateFrom<typeof machine> | undefined) =>
        (state as any)?.context.count;
      rerenders++;

      return (
        <div>
          <div data-testid="count">{selector(serviceState())}</div>
          <button
            data-testid="other"
            onclick={() => service.send({ type: 'OTHER' })}
          />
          <button
            data-testid="increment"
            onclick={() => service.send({ type: 'INCREMENT' })}
          />
        </div>
      );
    };

    render(() => <App />);
    const countButton = screen.getByTestId('count');
    const otherButton = screen.getByTestId('other');
    const incrementEl = screen.getByTestId('increment');

    fireEvent.click(incrementEl);

    rerenders = 0;

    fireEvent.click(otherButton);
    fireEvent.click(otherButton);
    fireEvent.click(otherButton);
    fireEvent.click(otherButton);

    expect(rerenders).toEqual(0);

    fireEvent.click(incrementEl);

    expect(countButton.textContent).toBe('2');
  });

  // TODO: rewrite this test to not use `from()`
  it.skip('should work with a custom comparison function', () => {
    const machine = createMachine({
      initial: 'active',
      context: {
        name: 'david'
      } as any,
      states: {
        active: {}
      },
      on: {
        CHANGE: ({ event }: any) => ({
          context: { name: event.value }
        })
      }
    });

    const App = () => {
      const service = useActorRef(machine);
      const serviceState = from(service);
      const name = createMemo(
        () => (serviceState() as any)!.context.name,
        serviceState(),
        { equals: (a: any, b: any) => a.toUpperCase() === b.toUpperCase() }
      );

      return (
        <div>
          <div data-testid="name">{name()}</div>
          <button
            data-testid="sendUpper"
            onclick={() =>
              service.send({ type: 'CHANGE', value: 'DAVID' } as any)
            }
          />
          <button
            data-testid="sendOther"
            onclick={() =>
              service.send({ type: 'CHANGE', value: 'other' } as any)
            }
          />
        </div>
      );
    };

    render(() => <App />);
    const nameEl = screen.getByTestId('name');
    const sendUpperButton = screen.getByTestId('sendUpper');
    const sendOtherButton = screen.getByTestId('sendOther');

    expect(nameEl.textContent).toEqual('david');

    fireEvent.click(sendUpperButton);

    // unchanged due to comparison function
    expect(nameEl.textContent).toEqual('david');

    fireEvent.click(sendOtherButton);

    expect(nameEl.textContent).toEqual('other');

    fireEvent.click(sendUpperButton);

    expect(nameEl.textContent).toEqual('DAVID');
  });

  it('should work with selecting values from initially spawned actors', () => {
    const childMachine = createMachine({
      context: {
        count: 0
      } as any,
      on: {
        UPDATE_COUNT: ({ context }) => ({
          context: { count: context.count + 1 }
        })
      }
    });

    const parentMachine = createMachine({
      context: {
        childActor: undefined as ActorRefFrom<typeof childMachine> | undefined
      } as any,
      entry: (_, enq) => ({
        context: {
          childActor: enq.spawn(childMachine)
        }
      })
    });

    const selector = (state: any) => state.context.count;

    const App = () => {
      const [state] = useMachine(parentMachine);
      const childActor = (state as any).context.childActor!;
      const childSnapshot = fromActorRef(childActor);

      return (
        <div>
          <div data-testid="count">{selector(childSnapshot() as any)}</div>

          <button
            onclick={() => childActor.send({ type: 'UPDATE_COUNT' })}
            data-testid="button"
          />
        </div>
      );
    };

    render(() => <App />);

    const buttonEl = screen.getByTestId('button');
    const countEl = screen.getByTestId('count');

    expect(countEl.textContent).toEqual('0');
    fireEvent.click(buttonEl);
    expect(countEl.textContent).toEqual('1');
  });

  it('should rerender with a new value when the selector changes', () => {
    const childMachine = createMachine({
      context: {
        count: 0
      } as any,
      on: {
        INC: ({ context }) => ({
          context: { count: context.count + 1 }
        })
      }
    });

    const parentMachine = createMachine({
      context: {
        childActor: undefined as ActorRefFrom<typeof childMachine> | undefined
      } as any,
      entry: (_, enq) => ({
        context: {
          childActor: enq.spawn(childMachine)
        }
      })
    });
    const [prop, setProp] = createSignal('first');

    const App = () => {
      const [state] = useMachine(parentMachine);
      const value = (stateValue: AnyMachineSnapshot) =>
        `${prop()} ${stateValue.context.count}`;
      return (
        <div data-testid="value">
          {value((state as any).context.childActor!.getSnapshot()!)}
        </div>
      );
    };

    const { container } = render(() => <App />);

    expect(container.textContent).toEqual('first 0');
    setProp('second');
    expect(container.textContent).toEqual('second 0');
  });

  it('should update selector value when actor changes', () => {
    const childMachine = (count: number) =>
      createMachine({
        initial: 'active',
        context: {
          count
        } as any,
        states: {
          active: {}
        }
      });

    const machine = createMachine({
      initial: 'active',
      context: {
        actorRef: undefined as any as ActorRefFrom<
          ReturnType<typeof childMachine>
        >
      } as any,
      states: {
        active: {
          entry: (_, enq) => ({
            context: {
              actorRef: enq.spawn(childMachine(1))
            }
          }),
          on: {
            CHANGE: (_, enq) => ({
              context: {
                actorRef: enq.spawn(childMachine(0))
              }
            })
          }
        },
        success: {}
      }
    });

    const App = () => {
      const [state, send] = useMachine(machine);
      return (
        <div>
          <div data-testid="count">
            {(state as any).context.actorRef!.getSnapshot()!.context.count}
          </div>
          <button
            data-testid="change-actor"
            onclick={() => send({ type: 'CHANGE' })}
          />
        </div>
      );
    };

    render(() => <App />);

    const div = screen.getByTestId('count');
    const button = screen.getByTestId('change-actor');

    expect(div.textContent).toEqual('1');
    fireEvent.click(button);
    expect(div.textContent).toEqual('0');
  });

  it('should use a fresh selector for subscription updates after selector change', () => {
    const childMachine = createMachine({
      context: {
        count: 0
      } as any,
      on: {
        INC: ({ context }) => ({
          context: { count: context.count + 1 }
        })
      }
    });

    const parentMachine = createMachine({
      context: {
        childActor: undefined as ActorRefFrom<typeof childMachine> | undefined
      } as any,
      entry: (_, enq) => ({
        context: {
          childActor: enq.spawn(childMachine)
        }
      })
    });
    const [prop, setProp] = createSignal('first');

    const App = () => {
      const [snapshot] = useMachine(parentMachine);
      const childActor = () => (snapshot as any).context.childActor!;
      const childSnapshot = fromActorRef(childActor);
      const value = createMemo(
        () => `${prop()} ${childSnapshot().context.count}`
      );
      return (
        <div>
          <div data-testid="value">{value()}</div>
          <button onclick={() => childActor().send({ type: 'INC' })} />
        </div>
      );
    };

    render(() => <App />);

    const buttonEl = screen.getByRole('button');
    const valueEl = screen.getByTestId('value');

    expect(valueEl.textContent).toEqual('first 0');
    setProp('second');

    fireEvent.click(buttonEl);

    expect(valueEl.textContent).toEqual('second 1');
  });
});
