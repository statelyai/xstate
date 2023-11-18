/* @jsxImportSource solid-js */
import {
  ActorRefFrom,
  AnyMachineSnapshot,
  StateFrom,
  assign,
  createMachine
} from 'xstate';
import { render, fireEvent, screen } from 'solid-testing-library';
import { useActor, createService, useMachine } from '../src/index.ts';
import { createMemo, createSignal, from } from 'solid-js';

describe('usage of selectors with reactive service state', () => {
  // TODO: rewrite this test to not use `from()`
  it.skip('only rerenders for selected values', () => {
    const machine = createMachine({
      types: {} as { context: { count: number; other: number } },
      initial: 'active',
      context: {
        other: 0,
        count: 0
      },
      states: {
        active: {}
      },
      on: {
        OTHER: {
          actions: assign({ other: ({ context }) => context.other + 1 })
        },
        INCREMENT: {
          actions: assign({ count: ({ context }) => context.count + 1 })
        }
      }
    });

    let rerenders = 0;

    const App = () => {
      const service = createService(machine);
      const serviceState = from(service);

      const selector = (state: StateFrom<typeof machine> | undefined) =>
        state?.context.count;
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
      types: {} as {
        context: { name: string };
        events: { type: 'CHANGE'; value: string };
      },
      initial: 'active',
      context: {
        name: 'david'
      },
      states: {
        active: {}
      },
      on: {
        CHANGE: {
          actions: assign({ name: ({ event }) => event.value })
        }
      }
    });

    const App = () => {
      const service = createService(machine);
      const serviceState = from(service);
      const name = createMemo(
        () => serviceState()!.context.name,
        serviceState(),
        { equals: (a, b) => a.toUpperCase() === b.toUpperCase() }
      );

      return (
        <div>
          <div data-testid="name">{name()}</div>
          <button
            data-testid="sendUpper"
            onclick={() => service.send({ type: 'CHANGE', value: 'DAVID' })}
          />
          <button
            data-testid="sendOther"
            onclick={() => service.send({ type: 'CHANGE', value: 'other' })}
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
      types: {} as { context: { count: number } },
      context: {
        count: 0
      },
      on: {
        UPDATE_COUNT: {
          actions: assign({
            count: ({ context }) => context.count + 1
          })
        }
      }
    });

    const parentMachine = createMachine({
      types: {} as {
        context: {
          childActor?: ActorRefFrom<typeof childMachine>;
        };
      },
      context: {},
      entry: assign({
        childActor: ({ spawn }) => spawn(childMachine)
      })
    });

    const selector = (state: StateFrom<typeof childMachine>) =>
      state.context.count;

    const App = () => {
      const [state] = useMachine(parentMachine);
      const [actorState, actorSend] = useActor(state.context.childActor!);

      return (
        <div>
          <div data-testid="count">{selector(actorState())}</div>

          <button
            onclick={() => actorSend({ type: 'UPDATE_COUNT' })}
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
      types: {} as { context: { count: number } },
      context: {
        count: 0
      },
      on: {
        INC: {
          actions: assign({
            count: ({ context }) => context.count + 1
          })
        }
      }
    });

    const parentMachine = createMachine({
      types: {} as {
        context: {
          childActor?: ActorRefFrom<typeof childMachine>;
        };
      },
      context: {},
      entry: assign({
        childActor: ({ spawn }) => spawn(childMachine)
      })
    });
    const [prop, setProp] = createSignal('first');

    const App = () => {
      const [state] = useMachine(parentMachine);
      const value = (stateValue: AnyMachineSnapshot) =>
        `${prop()} ${stateValue.context.count}`;
      return (
        <div data-testid="value">
          {value(state.context.childActor!.getSnapshot()!)}
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
        types: {} as { context: { count: number } },
        initial: 'active',
        context: {
          count
        },
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
      },
      states: {
        active: {
          entry: assign({
            actorRef: ({ spawn }) => spawn(childMachine(1))
          }),
          on: {
            CHANGE: {
              actions: [
                assign({
                  actorRef: ({ spawn }) => spawn(childMachine(0))
                })
              ]
            }
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
            {state.context.actorRef!.getSnapshot()!.context.count}
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
      types: {} as { context: { count: number } },
      context: {
        count: 0
      },
      on: {
        INC: {
          actions: assign({
            count: ({ context }) => context.count + 1
          })
        }
      }
    });

    const parentMachine = createMachine({
      types: {} as {
        context: {
          childActor?: ActorRefFrom<typeof childMachine>;
        };
      },
      context: {},
      entry: assign({
        childActor: ({ spawn }) => spawn(childMachine)
      })
    });
    const [prop, setProp] = createSignal('first');

    const App = () => {
      const [state] = useMachine(parentMachine);
      const [actorState, actorSend] = useActor(state.context.childActor!);
      const value = createMemo(() => `${prop()} ${actorState().context.count}`);
      return (
        <div>
          <div data-testid="value">{value()}</div>
          <button onclick={() => actorSend({ type: 'INC' })} />
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
