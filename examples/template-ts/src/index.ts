import { assign, createMachine, interpret, StateFrom } from 'xstate';
import './styles.css';

const eventOutputEl = document.getElementById('output-event')!;
const valueOutputEl = document.getElementById('output-value')!;
const contextOutputEl = document.getElementById('output-context')!;

const timeMachine = createMachine<{ time?: string }>(
  {
    id: 'time',
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
          src: 'fetchTime',
          onDone: {
            actions: assign({
              time: (_, event) => event.data
            })
          }
        },
        on: {
          cancel: 'idle'
        }
      },
      success: {
        on: {
          refetch: 'pending'
        }
      }
    }
  },
  {
    services: {
      fetchTime: () =>
        new Promise((res) => {
          setTimeout(() => {
            res(new Date().toLocaleTimeString());
          }, 1000);
        })
    }
  }
);

function renderState(state: StateFrom<typeof timeMachine>) {
  console.log(state);
  eventOutputEl.innerHTML = JSON.stringify(state.event, null, 2);
  valueOutputEl.innerHTML = JSON.stringify(state.value, null, 2);
  contextOutputEl.innerHTML = JSON.stringify(state.context, null, 2);
  console.log(`Next possible events:  ${state.nextEvents.join(', ')}`);
}

const timeActor = interpret(timeMachine)
  .onTransition((state) => {
    renderState(state);
  })
  .start();

(window as any).timeActor = timeActor;
