/* @jsxImportSource solid-js */
import { assign, createMachine, createActor } from 'xstate';
import { render, fireEvent, screen } from 'solid-testing-library';
import { createEffect, from } from 'solid-js';

describe("usage of interpret from core with Solid's from", () => {
  it('observer should be called with initial state', (done) => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            ACTIVATE: 'active'
          }
        },
        active: {}
      }
    });

    const App = () => {
      const service = createActor(machine).start();
      const serviceState = from(service);

      createEffect(() => {
        expect(serviceState()!.matches('inactive')).toBeTruthy();
        done();
      });

      return null;
    };

    render(() => <App />);
  });

  it('observer should be called with next state', (done) => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            ACTIVATE: 'active'
          }
        },
        active: {}
      }
    });

    const App = () => {
      const service = createActor(machine).start();
      const serviceState = from(service);
      createEffect(() => {
        if (serviceState()!.matches('active')) {
          done();
        }
      });

      return (
        <button
          data-testid="button"
          onclick={() => {
            service.send({ type: 'ACTIVATE' });
          }}
        />
      );
    };

    render(() => <App />);
    const button = screen.getByTestId('button');

    fireEvent.click(button);
  });

  it('service should work with from SolidJS utility', (done) => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            ACTIVATE: 'active'
          }
        },
        active: {}
      }
    });

    const App = () => {
      const service = createActor(machine).start();
      const serviceState = from(service);

      createEffect(() => {
        if (serviceState()!.matches('active')) {
          done();
        }
      });

      return (
        <button
          data-testid="button"
          onclick={() => {
            service.send({ type: 'ACTIVATE' });
          }}
        />
      );
    };

    render(() => <App />);
    const button = screen.getByTestId('button');

    fireEvent.click(button);
  });

  it('referenced object in context should not update both services', () => {
    const latestValue = { value: 100 };
    interface Context {
      latestValue: { value: number };
    }
    const machine = createMachine({
      types: {} as { context: Context; events: { type: 'INC' } },
      initial: 'initial',
      context: {
        latestValue
      },
      states: {
        initial: {
          on: {
            INC: {
              actions: [
                assign({
                  latestValue: ({ context }) => ({
                    value: context.latestValue.value + 1
                  })
                })
              ]
            }
          }
        }
      }
    });

    const Test = () => {
      const service1 = createActor(machine).start();
      const service2 = createActor(machine).start();
      const state1 = from(service1);
      const state2 = from(service2);
      return (
        <div>
          <div>
            <button
              data-testid="inc-machine1"
              onclick={() => service1.send({ type: 'INC' })}
            >
              INC 1
            </button>
            <div data-testid="value-machine1">
              {state1()!.context.latestValue.value}
            </div>
          </div>
          <div>
            <button
              data-testid="inc-machine2"
              onclick={() => service2.send({ type: 'INC' })}
            >
              INC 1
            </button>
            <div data-testid="value-machine2">
              {state2()!.context.latestValue.value}
            </div>
          </div>
        </div>
      );
    };

    render(() => <Test />);

    const machine1Value = screen.getByTestId('value-machine1');
    const machine2Value = screen.getByTestId('value-machine2');
    const incMachine1 = screen.getByTestId('inc-machine1');
    const incMachine2 = screen.getByTestId('inc-machine2');

    expect(machine1Value.textContent).toEqual('100');
    expect(machine2Value.textContent).toEqual('100');

    fireEvent.click(incMachine1);

    expect(machine1Value.textContent).toEqual('101');
    expect(machine2Value.textContent).toEqual('100');

    fireEvent.click(incMachine2);

    expect(machine1Value.textContent).toEqual('101');
    expect(machine2Value.textContent).toEqual('101');
  });
});
