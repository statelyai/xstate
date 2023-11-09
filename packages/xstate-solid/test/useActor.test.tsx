/* @jsxImportSource solid-js */
import { useMachine, useActor } from '../src';
import {
  createMachine,
  sendParent,
  assign,
  ActorRef,
  ActorRefFrom,
  createActor,
  Snapshot,
  fromTransition
} from 'xstate';
import { fireEvent, screen, render, waitFor } from 'solid-testing-library';
import {
  Accessor,
  Component,
  createEffect,
  createSignal,
  Match,
  on,
  onMount,
  Switch
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';

const createSimpleActor = <T extends unknown>(value: T) =>
  createActor(fromTransition((s) => s, value));

describe('useActor', () => {
  it('initial invoked actor should be immediately available', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {}
      }
    });
    const machine = createMachine({
      initial: 'active',
      invoke: {
        id: 'child',
        src: childMachine
      },
      states: {
        active: {}
      }
    });

    const ChildTest: Component<{ actor: ActorRefFrom<typeof childMachine> }> = (
      props
    ) => {
      const [state] = useActor(props.actor);

      expect(state().value).toEqual('active');
      done();

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      return (
        <ChildTest
          actor={state.children.child as ActorRefFrom<typeof childMachine>}
        />
      );
    };

    render(() => <Test />);
  });

  it('invoked actor should be able to receive (deferred) events that it replays when active', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent({ type: 'FINISH' }) }
          }
        }
      }
    });
    const machine = createMachine({
      initial: 'active',
      invoke: {
        id: 'child',
        src: childMachine
      },
      states: {
        active: {
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest: Component<{ actor: ActorRefFrom<typeof childMachine> }> = (
      props
    ) => {
      const [state, send] = useActor(props.actor);

      onMount(() => {
        expect(state().value).toEqual('active');
        send({ type: 'FINISH' });
      });

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      createEffect(() => {
        if (state.matches('success')) {
          done();
        }
      });

      return (
        <ChildTest
          actor={state.children.child as ActorRefFrom<typeof childMachine>}
        />
      );
    };

    render(() => <Test />);
  });

  it('send should update synchronously', (done) => {
    const machine = createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            done: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const Spawner = () => {
      const [service] = createSignal(createActor(machine).start());
      const [current, send] = useActor(service);

      onMount(() => {
        expect(current().value).toBe('start');
        send({ type: 'done' });
        expect(current().value).toBe('success');
      });

      return (
        <Switch fallback={null}>
          <Match when={current().value === 'start'}>
            <span data-testid="start" />
          </Match>
          <Match when={current().value === 'success'}>
            <span data-testid="success" />
          </Match>
        </Switch>
      );
    };

    render(() => <Spawner />);
    waitFor(() => screen.getByTestId('success')).then(() => done());
  });

  it('should only trigger effects once for nested context values', () => {
    const childMachine = createMachine({
      types: {} as {
        context: {
          item: { count: number; total: number };
        };
      },
      id: 'childMachine',
      initial: 'active',
      context: {
        item: {
          count: 0,
          total: 0
        }
      },
      states: {
        active: {
          on: {
            FINISH: {
              actions: [
                assign({
                  item: ({ context }) => ({
                    ...context.item,
                    total: context.item.total + 1
                  })
                }),

                sendParent({ type: 'FINISH' })
              ]
            },
            COUNT: {
              actions: [
                assign({
                  item: ({ context }) => ({
                    ...context.item,
                    count: context.item.count + 1
                  })
                })
              ]
            }
          }
        }
      }
    });
    const machine = createMachine({
      types: {} as {
        context: {
          actorRef?: ActorRefFrom<typeof childMachine>;
        };
      },
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: ({ spawn }) => spawn(childMachine)
          }),
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest = (props: {
      actor: Readonly<ActorRefFrom<typeof childMachine>>;
    }) => {
      const [state, send] = useActor(props.actor);
      const [count, setCount] = createSignal(0);
      const [total, setTotal] = createSignal(0);
      createEffect(
        on(
          () => state().context.item.count,
          () => {
            setCount(() => count() + 1);
          },
          { defer: true }
        )
      );

      createEffect(
        on(
          () => state().context.item.total,
          () => {
            setTotal(() => total() + 1);
          },
          { defer: true }
        )
      );

      onMount(() => {
        send({ type: 'COUNT' });
        send({ type: 'FINISH' });
      });

      return (
        <div>
          <div data-testid="count">{count()}</div>
          <div data-testid="total">{total()}</div>
        </div>
      );
    };

    const Test = () => {
      const [state] = useMachine(machine);

      return <ChildTest actor={state.context.actorRef!} />;
    };

    render(() => <Test />);
    const countEl = screen.getByTestId('count');
    const totalEl = screen.getByTestId('total');

    // Effect should only trigger once for the count and total:
    expect(countEl.textContent).toEqual('1');
    expect(totalEl.textContent).toEqual('1');
  });

  it('initial spawned actor should be immediately available', () => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {}
      }
    });

    interface Ctx {
      actorRef?: ActorRefFrom<typeof childMachine>;
    }

    const machine = createMachine({
      types: {} as { context: Ctx },
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: ({ spawn }) => spawn(childMachine)
          })
        }
      }
    });

    const ChildTest: Component<{ actor: ActorRefFrom<typeof childMachine> }> = (
      props
    ) => {
      const [state] = useActor(props.actor);

      expect(state().value).toEqual('active');

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      const { actorRef } = state.context;

      return <ChildTest actor={actorRef!} />;
    };

    render(() => <Test />);
  });

  it('should be reactive to toJSON method calls', () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: {
          on: {
            TRANSITION: 'yellow'
          }
        },
        yellow: {
          on: {
            TRANSITION: 'red'
          }
        },
        red: {
          on: {
            TRANSITION: 'green'
          }
        }
      }
    });

    const App = () => {
      const service = createActor(machine).start();
      const [state, send] = useActor(service);
      const [toJson, setToJson] = createSignal(state().toJSON());
      createEffect(
        on(
          () => state().value,
          () => {
            setToJson(state().toJSON());
          }
        )
      );
      return (
        <div>
          <button
            data-testid="transition-button"
            onclick={() => send({ type: 'TRANSITION' })}
          />
          <div data-testid="to-json">{(toJson() as any).value.toString()}</div>
        </div>
      );
    };

    render(() => <App />);
    const toJsonEl = screen.getByTestId('to-json');
    const transitionBtn = screen.getByTestId('transition-button');

    // Green
    expect(toJsonEl.textContent).toEqual('green');
    transitionBtn.click();

    // Yellow
    expect(toJsonEl.textContent).toEqual('yellow');
    transitionBtn.click();

    // Red
    expect(toJsonEl.textContent).toEqual('red');
    transitionBtn.click();

    // Green
    expect(toJsonEl.textContent).toEqual('green');
  });

  it('should be reactive to hasTag method calls', () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: {
          tags: 'go',
          on: {
            TRANSITION: 'yellow'
          }
        },
        yellow: {
          tags: 'go',
          on: {
            TRANSITION: 'red'
          }
        },
        red: {
          tags: ['stop', 'other'],
          on: {
            TRANSITION: 'green'
          }
        }
      }
    });

    const App = () => {
      const service = createActor(machine).start();
      const [state, send] = useActor(service);
      const [canGo, setCanGo] = createSignal(state().hasTag('go'));
      createEffect(() => {
        setCanGo(state().hasTag('go'));
      });
      return (
        <div>
          <button
            data-testid="transition-button"
            onclick={() => send({ type: 'TRANSITION' })}
          />
          <div data-testid="can-go">{canGo().toString()}</div>
          <div data-testid="stop">{state().hasTag('stop').toString()}</div>
        </div>
      );
    };

    render(() => <App />);
    const canGoEl = screen.getByTestId('can-go');
    const stopEl = screen.getByTestId('stop');
    const transitionBtn = screen.getByTestId('transition-button');

    // Green
    expect(canGoEl.textContent).toEqual('true');
    expect(stopEl.textContent).toEqual('false');
    transitionBtn.click();

    // Yellow
    expect(canGoEl.textContent).toEqual('true');
    expect(stopEl.textContent).toEqual('false');
    transitionBtn.click();

    // Red
    expect(canGoEl.textContent).toEqual('false');
    expect(stopEl.textContent).toEqual('true');
    transitionBtn.click();

    // Green
    expect(canGoEl.textContent).toEqual('true');
    expect(stopEl.textContent).toEqual('false');
  });

  it('should be reactive to can method calls', () => {
    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            TOGGLE: 'active'
          }
        },
        active: {
          on: {
            DO_SOMETHING: { actions: ['something'] }
          }
        }
      }
    });

    const App = () => {
      const service = createActor(machine).start();
      const [state, send] = useActor(service);
      const [canToggle, setCanToggle] = createSignal(
        state().can({ type: 'TOGGLE' })
      );
      createEffect(() => {
        setCanToggle(state().can({ type: 'TOGGLE' }));
      });
      return (
        <div>
          <button
            data-testid="toggle-button"
            onclick={() => send({ type: 'TOGGLE' })}
          />
          <div data-testid="can-toggle">{canToggle().toString()}</div>
          <div data-testid="can-do-something">
            {state().can({ type: 'DO_SOMETHING' }).toString()}
          </div>
        </div>
      );
    };

    render(() => <App />);
    const canToggleEl = screen.getByTestId('can-toggle');
    const canDoSomethingEl = screen.getByTestId('can-do-something');
    const toggleBtn = screen.getByTestId('toggle-button');

    expect(canToggleEl.textContent).toEqual('true');
    expect(canDoSomethingEl.textContent).toEqual('false');
    toggleBtn.click();
    expect(canToggleEl.textContent).toEqual('false');
    expect(canDoSomethingEl.textContent).toEqual('true');
  });

  it('spawned actor should be able to receive (deferred) events that it replays when active', (done) => {
    const childMachine = createMachine({
      id: 'childMachine',
      initial: 'active',
      states: {
        active: {
          on: {
            FINISH: { actions: sendParent({ type: 'FINISH' }) }
          }
        }
      }
    });
    const machine = createMachine({
      types: {} as {
        context: {
          actorRef?: ActorRefFrom<typeof childMachine>;
        };
      },
      initial: 'active',
      context: {
        actorRef: undefined
      },
      states: {
        active: {
          entry: assign({
            actorRef: ({ spawn }) => spawn(childMachine)
          }),
          on: { FINISH: 'success' }
        },
        success: {}
      }
    });

    const ChildTest = (props: { actor: ActorRefFrom<typeof childMachine> }) => {
      const [state, send] = useActor(props.actor);
      createEffect(() => {
        expect(state().value).toEqual('active');
      });

      onMount(() => {
        send({ type: 'FINISH' });
      });

      return null;
    };

    const Test = () => {
      const [state] = useMachine(machine);
      createEffect(() => {
        if (state.matches('success')) {
          done();
        }
      });

      return <ChildTest actor={state.context.actorRef!} />;
    };

    render(() => <Test />);
  });

  it('should provide value from `actor.getSnapshot()` immediately', () => {
    const simpleActor = createActor(fromTransition((s) => s, 42));

    const Test = () => {
      const [state] = useActor(simpleActor);

      return <div data-testid="state">{state().context}</div>;
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');

    expect(div.textContent).toEqual('42');
  });

  it('should update snapshot value when actor changes', () => {
    const Test = () => {
      const [actor, setActor] = createSignal(createSimpleActor(42));
      const [state] = useActor(actor);

      return (
        <div>
          <div data-testid="state">{state().context}</div>
          <button
            data-testid="button"
            onclick={() => setActor(createSimpleActor(100))}
          />
        </div>
      );
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');
    const button = screen.getByTestId('button');

    expect(div.textContent).toEqual('42');
    fireEvent.click(button);
    expect(div.textContent).toEqual('100');
  });

  it('should update snapshot Date value when actor changes', () => {
    const Test = () => {
      const [actor, setActor] = createSignal(
        createSimpleActor(new Date('2020-08-21'))
      );
      const [state] = useActor(actor);

      return (
        <div>
          <div data-testid="state">{state().context.getFullYear()}</div>
          <button
            data-testid="button"
            onclick={() => setActor(createSimpleActor(new Date('2022-08-21')))}
          />
        </div>
      );
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');
    const button = screen.getByTestId('button');

    expect(div.textContent).toEqual('2020');
    fireEvent.click(button);
    expect(div.textContent).toEqual('2022');
  });

  it('should rerender and trigger effects only on array changes', () => {
    const Test = () => {
      const [actor, setActor] = createSignal(createSimpleActor(['1', '2']));
      const [state] = useActor(actor);
      const [change, setChange] = createSignal(0);

      createEffect(() => {
        if (state().context[0]) {
          setChange((val) => val + 1);
        }
      });

      return (
        <div>
          <div data-testid="change">{change()}</div>
          <div data-testid="state">{state().context[1]}</div>
          <div data-testid="state-2">{state().context[3]}</div>
          <button
            data-testid="button"
            onclick={() => setActor(createSimpleActor(['1', '3', '5', '8']))}
          />
        </div>
      );
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');
    const div2 = screen.getByTestId('state-2');
    const changeVal = screen.getByTestId('change');
    const button = screen.getByTestId('button');

    expect(changeVal.textContent).toEqual('1');
    expect(div.textContent).toEqual('2');
    fireEvent.click(button);
    expect(div.textContent).toEqual('3');
    expect(changeVal.textContent).toEqual('1');
    expect(div2.textContent).toEqual('8');
  });

  it('should rerender and trigger effects only on array size changes', () => {
    const Test = () => {
      const [actor, setActor] = createSignal(
        createSimpleActor(['1', '3', '5', '8'])
      );
      const [state] = useActor(actor);
      const [change, setChange] = createSignal(0);

      createEffect(() => {
        if (state().context[0]) {
          setChange((val) => val + 1);
        }
      });

      return (
        <div>
          <div data-testid="change">{change()}</div>
          <div data-testid="state">{state().context[1]}</div>
          <div data-testid="state-2">{state().context[3]}</div>
          <button
            data-testid="button"
            onclick={() => setActor(createSimpleActor(['1', '2']))}
          />
        </div>
      );
    };

    render(() => <Test />);

    const div = screen.getByTestId('state');
    const div2 = screen.getByTestId('state-2');
    const changeVal = screen.getByTestId('change');
    const button = screen.getByTestId('button');

    expect(changeVal.textContent).toEqual('1');
    expect(div.textContent).toEqual('3');
    expect(div2.textContent).toEqual('8');
    fireEvent.click(button);
    expect(div.textContent).toEqual('2');
    expect(changeVal.textContent).toEqual('1');
    expect(div2.textContent).toEqual('');
  });

  it('should properly handle array updates', () => {
    const numberListMachine = createMachine({
      types: {} as { context: { numbers: number[] } },
      context: {
        numbers: [1, 2, 3, 4, 5, 6]
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            REMOVE_START: {
              actions: assign({
                numbers: ({ context }) => {
                  return context.numbers.filter((_, i) => i !== 0);
                }
              })
            },
            REMOVE_END: {
              actions: assign({
                numbers: ({ context }) => {
                  return context.numbers.filter(
                    (_, i) => i !== context.numbers.length - 1
                  );
                }
              })
            },
            ADD: {
              actions: assign({
                numbers: ({ context }) => {
                  return [
                    ...context.numbers,
                    context.numbers[context.numbers.length - 1] + 1
                  ];
                }
              })
            }
          }
        }
      }
    });

    const Test = () => {
      const [state, send] = useMachine(numberListMachine);
      return (
        <div>
          <div data-testid="state">{state.context.numbers.join(',')}</div>
          <button
            data-testid="remove-start"
            onclick={() => send({ type: 'REMOVE_START' })}
          />
          <button
            data-testid="remove-end"
            onclick={() => send({ type: 'REMOVE_END' })}
          />
          <button data-testid="add" onclick={() => send({ type: 'ADD' })} />
        </div>
      );
    };

    render(() => <Test />);

    const state = screen.getByTestId('state');
    const removeStart = screen.getByTestId('remove-start');
    const removeEnd = screen.getByTestId('remove-end');
    const add = screen.getByTestId('add');

    expect(state.textContent).toEqual('1,2,3,4,5,6');
    fireEvent.click(removeStart);
    expect(state.textContent).toEqual('2,3,4,5,6');
    fireEvent.click(removeEnd);
    expect(state.textContent).toEqual('2,3,4,5');
    fireEvent.click(add);
    expect(state.textContent).toEqual('2,3,4,5,6');
  });

  it('should rerender and trigger effects only on object within array changes', () => {
    const arr = [
      { id: '1', value: 10 },
      { id: '2', value: 20 }
    ];
    const actorMachine = createMachine({
      types: {} as {
        context: { arr: Array<{ id: string; value: number }> };
        events: { type: 'CHANGE'; index: number; value: number };
      },
      context: {
        arr
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            CHANGE: {
              actions: [
                assign(({ context, event }) => {
                  const newCtx = { ...context };
                  newCtx.arr = [...newCtx.arr];
                  newCtx.arr[event.index] = {
                    ...newCtx.arr[event.index],
                    value: event.value
                  };
                  return newCtx;
                })
              ]
            }
          }
        }
      }
    });

    const Test = () => {
      const [state, send] = useActor(createActor(actorMachine).start());
      const [changeIndex0, setChangeIndex0] = createSignal(0);
      const [changeIndex1, setChangeIndex1] = createSignal(0);
      const [changeRoot, setChangeRoot] = createSignal(0);

      createEffect(() => {
        if (state().context.arr) {
          setChangeRoot((val) => val + 1);
        }
      });
      createEffect(() => {
        if (state().context.arr[0].value) {
          setChangeIndex0((val) => val + 1);
        }
      });

      createEffect(() => {
        if (state().context.arr[1].value) {
          setChangeIndex1((val) => val + 1);
        }
      });

      return (
        <div>
          <div data-testid="change-root">{changeRoot()}</div>
          <div data-testid="change-index-0">{changeIndex0()}</div>
          <div data-testid="change-index-1">{changeIndex1()}</div>
          <div data-testid="state-0">{state().context.arr[0].value}</div>
          <div data-testid="state-1">{state().context.arr[1].value}</div>
          <button
            data-testid="index-0-btn"
            onclick={() => send({ type: 'CHANGE', index: 0, value: -10 })}
          />
          <button
            data-testid="index-1-btn"
            onclick={() => send({ type: 'CHANGE', index: 1, value: 22 })}
          />
        </div>
      );
    };

    render(() => <Test />);

    const stateIndex0 = screen.getByTestId('state-0');
    const stateIndex1 = screen.getByTestId('state-1');
    const changeRootVal = screen.getByTestId('change-root');
    const changeIndex0Val = screen.getByTestId('change-index-0');
    const changeIndex1Val = screen.getByTestId('change-index-1');
    const changeIndex0Btn = screen.getByTestId('index-0-btn');
    const changeIndex1Btn = screen.getByTestId('index-1-btn');

    // Initial values
    expect(stateIndex0.textContent).toEqual('10');
    expect(stateIndex1.textContent).toEqual('20');
    expect(changeRootVal.textContent).toEqual('1');
    expect(changeIndex0Val.textContent).toEqual('1');
    expect(changeIndex1Val.textContent).toEqual('1');

    // Change index 0
    fireEvent.click(changeIndex0Btn);

    expect(stateIndex0.textContent).toEqual('-10');
    expect(stateIndex1.textContent).toEqual('20');
    expect(changeRootVal.textContent).toEqual('1');
    expect(changeIndex0Val.textContent).toEqual('2');
    expect(changeIndex1Val.textContent).toEqual('1');

    // Change index 1
    fireEvent.click(changeIndex1Btn);

    expect(stateIndex0.textContent).toEqual('-10');
    expect(stateIndex1.textContent).toEqual('22');
    expect(changeRootVal.textContent).toEqual('1');
    expect(changeIndex0Val.textContent).toEqual('2');
    expect(changeIndex1Val.textContent).toEqual('2');

    // Check original array was cloned and is unchanged
    expect(arr[0].value).toEqual(10);
    expect(arr[1].value).toEqual(20);
  });

  it('getSnapshot Map should match vanilla Solid behavior', () => {
    const Test = () => {
      const map1 = new Map([
        ['prop1', 'value'],
        ['prop2', '5']
      ]);
      const [actor, setActor] = createSignal(createSimpleActor(map1));
      const [signal, setSignal] = createSignal(map1);
      const [state] = useActor(actor);
      const [actorChange, setActorChange] = createSignal(0);
      const [signalChange, setSignalChange] = createSignal(0);

      createEffect(() => {
        if (state().context.get('prop1')) {
          setActorChange((val) => val + 1);
        }
      });

      createEffect(() => {
        if (signal().get('prop1')) {
          setSignalChange((val) => val + 1);
        }
      });

      return (
        <div>
          <div data-testid="actor-change">{actorChange()}</div>
          <div data-testid="signal-change">{signalChange()}</div>
          <div data-testid="actor-state">{signal().get('prop2')}</div>
          <div data-testid="signal-state">{state().context.get('prop2')}</div>
          <button
            data-testid="button"
            onclick={() => {
              const newMap = new Map([
                ['prop1', 'value'],
                ['prop2', '10']
              ]);
              setSignal(newMap);
              setActor(createSimpleActor(newMap));
            }}
          />
        </div>
      );
    };

    render(() => <Test />);

    const actorState = screen.getByTestId('actor-state');
    const signalState = screen.getByTestId('signal-state');
    const actorChangeVal = screen.getByTestId('actor-change');
    const signalChangeVal = screen.getByTestId('signal-change');
    const button = screen.getByTestId('button');

    expect(signalChangeVal.textContent).toEqual('1');
    expect(actorChangeVal.textContent).toEqual('1');
    expect(actorState.textContent).toEqual('5');
    expect(signalState.textContent).toEqual('5');
    fireEvent.click(button);
    expect(actorState.textContent).toEqual('10');
    expect(signalState.textContent).toEqual('10');
    expect(signalChangeVal.textContent).toEqual('2');
    expect(actorChangeVal.textContent).toEqual('2');
  });

  it('getSnapshot nested store Map should match vanilla Solid behavior', () => {
    const Test = () => {
      const map1 = new Map([
        ['prop1', 'value'],
        ['prop2', '5']
      ]);
      const [actor, setActor] = createSignal(
        createSimpleActor({ value: map1 })
      );
      const [signal, setSignal] = createStore({ value: map1 });
      const [state] = useActor(actor);
      const [actorChange, setActorChange] = createSignal(0);
      const [signalChange, setSignalChange] = createSignal(0);

      createEffect(() => {
        if (state().context.value.get('prop1')) {
          setActorChange((val) => val + 1);
        }
      });

      createEffect(() => {
        if (signal.value.get('prop1')) {
          setSignalChange((val) => val + 1);
        }
      });

      return (
        <div>
          <div data-testid="actor-change">{actorChange()}</div>
          <div data-testid="signal-change">{signalChange()}</div>
          <div data-testid="actor-state">{signal.value.get('prop2')}</div>
          <div data-testid="signal-state">
            {state().context.value.get('prop2')}
          </div>
          <button
            data-testid="change-button"
            onclick={() => {
              const newMap = new Map([
                ['prop1', 'value'],
                ['prop2', '10']
              ]);
              setSignal(reconcile({ value: newMap }));
              setActor(createSimpleActor({ value: newMap }));
            }}
          />
          <button
            data-testid="button"
            onclick={() => {
              const newMap = new Map([
                ['prop1', 'value'],
                ['prop2', '10']
              ]);
              setSignal(reconcile({ value: newMap }));
              setActor(createSimpleActor({ value: newMap }));
            }}
          />
        </div>
      );
    };

    render(() => <Test />);

    const actorState = screen.getByTestId('actor-state');
    const signalState = screen.getByTestId('signal-state');
    const actorChangeVal = screen.getByTestId('actor-change');
    const signalChangeVal = screen.getByTestId('signal-change');
    const button = screen.getByTestId('button');

    expect(signalChangeVal.textContent).toEqual('1');
    expect(actorChangeVal.textContent).toEqual('1');
    expect(actorState.textContent).toEqual('5');
    expect(signalState.textContent).toEqual('5');
    fireEvent.click(button);
    expect(actorState.textContent).toEqual('10');
    expect(signalState.textContent).toEqual('10');
    expect(signalChangeVal.textContent).toEqual('2');
    expect(actorChangeVal.textContent).toEqual('2');
  });

  it('send() should be stable', (done) => {
    jest.useFakeTimers();
    const firstActor = createSimpleActor(null);
    const lastActor = createSimpleActor(null);
    lastActor.send = () => done();

    const Test = () => {
      const [actor, setActor] = createSignal(firstActor);
      const [, send] = useActor(actor);

      onMount(() => {
        setTimeout(() => {
          // The `send` here is closed-in
          send({ type: 'anything' });
        }, 10);
      });

      return (
        <button data-testid="button" onclick={() => setActor(lastActor)} />
      );
    };

    render(() => <Test />);

    // At this point, `send` refers to the first (noop) actor

    const button = screen.getByTestId('button');
    fireEvent.click(button);
    jest.advanceTimersByTime(100);
    // At this point, `send` refers to the last actor
    // The effect will call the closed-in `send`, which originally
    // was the reference to the first actor. Now that `send` is stable,
    // it will always refer to the latest actor.
  });

  it('should also work with services', () => {
    const counterMachine = createMachine(
      {
        types: {} as {
          context: { count: number };
          events: { type: 'INC' } | { type: 'SOMETHING' };
        },
        id: 'counter',
        initial: 'active',
        context: { count: 0 },
        states: {
          active: {
            on: {
              INC: {
                actions: assign({ count: ({ context }) => context.count + 1 })
              },
              SOMETHING: { actions: 'doSomething' }
            }
          }
        }
      },
      {
        actions: {
          doSomething: () => {
            /* do nothing */
          }
        }
      }
    );
    const counterService = createActor(counterMachine).start();

    const Counter = () => {
      const [state, send] = useActor(counterService);

      return (
        <div
          data-testid="count"
          onclick={() => {
            send({ type: 'INC' });
            // @ts-expect-error
            send({ type: 'FAKE' });
          }}
        >
          {state().context.count}
        </div>
      );
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

  it(`actor should not reevaluate a scope depending on state.matches when state.value doesn't change`, (done) => {
    jest.useFakeTimers();

    interface MachineContext {
      counter: number;
    }

    const machine = createMachine({
      types: {} as {
        context: MachineContext;
      },
      context: {
        counter: 0
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            INC: {
              actions: assign({
                counter: ({ context }) => context.counter + 1
              })
            }
          }
        }
      }
    });

    const counterService = createActor(machine).start();

    const Comp = () => {
      let calls = 0;
      const [state, send] = useActor(counterService);

      createEffect(() => {
        calls++;
        state().matches('foo');
      });

      onMount(() => {
        send({ type: 'INC' });
        send({ type: 'INC' });
        send({ type: 'INC' });
        setTimeout(() => {
          send({ type: 'INC' });
          setTimeout(() => {
            send({ type: 'INC' });
            setTimeout(() => {
              expect(calls).toBe(1);
              done();
            }, 100);
          });
        });
      });

      return null;
    };

    render(() => <Comp />);
    jest.advanceTimersByTime(110);
  });

  it('actor should be updated when it changes shallow', () => {
    const counterMachine = createMachine({
      types: {} as { context: { count: number } },
      id: 'counter',
      initial: 'active',
      context: { count: 0 },
      states: {
        active: {
          on: {
            INC: {
              actions: assign({ count: ({ context }) => context.count + 1 })
            },
            SOMETHING: { actions: 'doSomething' }
          }
        }
      }
    });

    const counterService1 = createActor(counterMachine).start();
    const counterService2 = createActor(counterMachine).start();

    const Counter = (props: {
      counterRef: Accessor<ActorRefFrom<typeof counterMachine>>;
    }) => {
      const [state, send] = useActor(props.counterRef);

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
          <div data-testid="count">{state().context.count}</div>
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

  it('actor should be updated when it changes deep', () => {
    const counterMachine2 = createMachine({
      types: {} as {
        context: {
          subCount: { subCount1: { subCount2: { count: number } } };
        };
      },
      id: 'counter',
      initial: 'active',
      context: { subCount: { subCount1: { subCount2: { count: 0 } } } },
      states: {
        active: {
          on: {
            INC: {
              actions: assign({
                subCount: ({ context }) => ({
                  ...context.subCount,
                  subCount1: {
                    ...context.subCount.subCount1,
                    subCount2: {
                      ...context.subCount.subCount1.subCount2,
                      count: context.subCount.subCount1.subCount2.count + 1
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
    const counterService1 = createActor(counterMachine2).start();
    const counterService2 = createActor(counterMachine2).start();

    const Counter = (props: {
      counterRef: Accessor<ActorRefFrom<typeof counterMachine2>>;
    }) => {
      const [state, send] = useActor(props.counterRef);

      return (
        <div>
          <button data-testid="inc" onclick={(_) => send({ type: 'INC' })} />
          <div data-testid="count">
            {state().context.subCount.subCount1.subCount2.count}
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

  it('actor should only trigger effect of directly tracked value', () => {
    const counterMachine2 = createMachine({
      types: {} as {
        context: {
          subCount: { subCount1: { subCount2: { count: number } } };
        };
      },
      id: 'counter',
      initial: 'active',
      context: { subCount: { subCount1: { subCount2: { count: 0 } } } },
      states: {
        active: {
          on: {
            INC: {
              actions: assign({
                subCount: ({ context }) => ({
                  ...context.subCount,
                  subCount1: {
                    ...context.subCount.subCount1,
                    subCount2: {
                      ...context.subCount.subCount1.subCount2,
                      count: context.subCount.subCount1.subCount2.count + 1
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

    const Counter = () => {
      const counterService = createActor(counterMachine2).start();
      const [state, send] = useActor(counterService);
      const [effectCount, setEffectCount] = createSignal(0);
      createEffect(
        on(
          () => state().context.subCount.subCount1,
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
            {state().context.subCount.subCount1.subCount2.count}
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

  it('referenced object in context should not update both services', () => {
    const latestValue = { value: 100 };
    interface Context {
      latestValue: { value: number };
    }
    const machine = createMachine({
      types: {} as {
        context: Context;
        events: { type: 'INC' };
      },
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
      const [state1, send1] = useActor(service1);
      const [state2, send2] = useActor(service2);

      return (
        <div>
          <div>
            <button
              data-testid="inc-machine1"
              onclick={() => send1({ type: 'INC' })}
            >
              INC 1
            </button>
            <div data-testid="value-machine1">
              {state1().context.latestValue.value}
            </div>
          </div>
          <div>
            <button
              data-testid="inc-machine2"
              onclick={() => send2({ type: 'INC' })}
            >
              INC 1
            </button>
            <div data-testid="value-machine2">
              {state2().context.latestValue.value}
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

  it('should work with initially deferred actors spawned in lazy context', () => {
    const childMachine = createMachine({
      initial: 'one',
      states: {
        one: {
          on: { NEXT: 'two' }
        },
        two: {}
      }
    });

    const machine = createMachine({
      types: {} as { context: { ref: ActorRef<any, any> } },
      context: ({ spawn }) => ({
        ref: spawn(childMachine)
      }),
      initial: 'waiting',
      states: {
        waiting: {
          on: { TEST: 'success' }
        },
        success: {
          type: 'final'
        }
      }
    });

    const App = () => {
      const [state] = useMachine(machine);
      const [childState, childSend] = useActor(state.context.ref);

      return (
        <div>
          <div data-testid="child-state">{childState().value}</div>
          <button
            data-testid="child-send"
            onclick={() => childSend({ type: 'NEXT' })}
          />
        </div>
      );
    };

    render(() => <App />);

    const elState = screen.getByTestId('child-state');
    const elSend = screen.getByTestId('child-send');
    expect(elState.textContent).toEqual('one');
    fireEvent.click(elSend);

    expect(elState.textContent).toEqual('two');
  });
});
