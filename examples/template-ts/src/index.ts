import { assign, createMachine, interpret, StateFrom } from 'xstate';
import './styles.css';

const eventOutputEl = document.getElementById('output-event')!;
const valueOutputEl = document.getElementById('output-value')!;
const contextOutputEl = document.getElementById('output-context')!;

const taskMachine = createMachine<{ time?: string }>({
  initial: 'idle',
  context: {
    time: undefined
  },
  states: {
    idle: {
      on: {
        fetch: 'pending'
      }
    },
    pending: {
      invoke: {
        src: () =>
          new Promise((res) => {
            setTimeout(() => {
              res(new Date().toLocaleTimeString());
            }, 1000);
          }),
        onDone: {
          actions: assign({
            time: (_, event) => event.data
          })
        }
      }
    },
    success: {
      on: {
        refetch: 'pending'
      }
    }
  }
});

function renderState(state: StateFrom<typeof taskMachine>) {
  console.log(state);
  eventOutputEl.innerHTML = JSON.stringify(state.event, null, 2);
  valueOutputEl.innerHTML = JSON.stringify(state.value, null, 2);
  contextOutputEl.innerHTML = JSON.stringify(state.context, null, 2);
}

const time = interpret(taskMachine)
  .onTransition((state) => {
    renderState(state);
  })
  .start();

(window as any).time = time;
