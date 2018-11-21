import React, { Component, useMemo, useEffect, useState } from 'react';
import './App.css';
import { counterMachine } from './machines/counter';
import { interpret } from 'xstate/lib/interpreter';
import { StateMachine, State } from 'xstate';

function useMachine<TContext>(
  machine: StateMachine<TContext, any, any>
): [State<TContext, any>, any] {
  const [current, setCurrent] = useState(machine.initialState);
  const service = useMemo(
    () =>
      interpret(machine)
        .onTransition(state => {
          // @ts-ignore
          setCurrent(state);
        })
        .start(),
    [machine]
  );

  useEffect(() => {
    return () => service.stop();
  }, []);

  return [current, service.send];
}

function Counter() {
  const [current, send] = useMachine(counterMachine);

  return (
    <div>
      <input type="text" value={current.context.count} readOnly />
      <button onClick={() => send('INCREMENT')}>+</button>
      <button onClick={() => send('DECREMENT')}>-</button>
    </div>
  );
}

// tslint:disable-next-line:max-classes-per-file
class App extends Component {
  public render() {
    return (
      <div className="App">
        <Counter />
      </div>
    );
  }
}

export default App;
