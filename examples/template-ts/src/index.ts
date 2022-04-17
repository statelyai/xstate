import { assign, createMachine, interpret, StateFrom } from 'xstate';
import './styles.css';

const eventOutputEl = document.getElementById('output-event')!;
const valueOutputEl = document.getElementById('output-value')!;
const contextOutputEl = document.getElementById('output-context')!;

const feedbackMachine = createMachine<
  { content: string | null },
  | { type: 'good' }
  | { type: 'bad' }
  | { type: 'submit'; content: string }
  | { type: 'back' }
  | { type: 'close' }
>({
  id: 'feedback',
  initial: 'question',
  context: {
    content: null
  },
  states: {
    question: {
      on: {
        good: 'thanks',
        bad: 'form'
      }
    },
    form: {
      initial: 'normal',
      states: {
        normal: {},
        invalid: {}
      },
      on: {
        back: 'question',
        submit: [
          {
            cond: (context, event) => {
              return event.content.length > 0;
            },
            actions: assign({
              content: (context, event) => event.content
            }),
            target: 'thanks'
          },
          { target: '.invalid' }
        ]
      }
    },
    thanks: {},
    closed: {
      type: 'final'
    }
  },
  on: {
    close: '.closed'
  }
});

console.log(
  `Send events to the feedback actor, e.g.: \n\n${[
    'feedback.send({ type: "good" })',
    'feedback.send({ type: "bad" })',
    'feedback.send({ type: "submit", contents: "Some feedback" })',
    'feedback.send({ type: "back" })',
    'feedback.send({ type: "close" })'
  ].join('\n')}`
);

function renderState(state: StateFrom<typeof feedbackMachine>) {
  console.log(state);
  eventOutputEl.innerHTML = JSON.stringify(state.event, null, 2);
  valueOutputEl.innerHTML = JSON.stringify(state.value, null, 2);
  contextOutputEl.innerHTML = JSON.stringify(state.context, null, 2);
}

const feedback = interpret(feedbackMachine)
  .onTransition((state) => {
    renderState(state);
  })
  .start();

(window as any).feedback = feedback;
