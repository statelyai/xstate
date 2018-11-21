import React, { Component, useMemo, useEffect, useState } from 'react';
import './App.css';
import { counterMachine } from './machines/counter';
import { interpret } from 'xstate/lib/interpreter';
import { StateMachine, State } from 'xstate';
import { temperatureMachine } from './machines/temperature';

function useMachine<TContext>(
  machine: StateMachine<TContext, any, any>
): [State<TContext, any>, any] {
  const [current, setCurrent] = useState(machine.initialState);
  const service = useMemo(
    () =>
      interpret(machine)
        .onTransition(state => {
          console.log('STATE:', state);
          // @ts-ignore
          setCurrent(state);
        })
        .onEvent(e => console.log('EVENT:', e))
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

function TempConverter() {
  const [current, send] = useMachine(temperatureMachine);

  return (
    <div>
      <input
        type="text"
        name="C"
        onChange={e => send(e)}
        onFocus={_ => send('FOCUS_C')}
        value={current.context.C}
        placeholder="Celsius"
        style={{
          background: current.matches({ celsius: 'invalid' })
            ? 'red'
            : 'initial'
        }}
      />
      <input
        type="text"
        name="F"
        onChange={e => send(e)}
        onFocus={_ => send('FOCUS_F')}
        value={current.context.F}
        placeholder="Fahrenheit"
        style={{
          background: current.matches({ fahrenheit: 'invalid' })
            ? 'red'
            : 'initial'
        }}
      />
    </div>
  );
}

// tslint:disable-next-line:max-classes-per-file
class App extends Component {
  public render() {
    return (
      <div className="App">
        <Counter />
        <TempConverter />
      </div>
    );
  }
}

export default App;
