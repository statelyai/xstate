import { assign, createMachine } from 'xstate';
import {
  getMachineShortestPaths,
  getShortestPaths
} from '../src/shortestPaths';

const schema = {
  context: {} as { feedback: string },
  events: {} as
    | {
        type: 'feedback.good';
      }
    | {
        type: 'feedback.bad';
      }
    | {
        type: 'feedback.update';
        value: string;
      }
    | { type: 'submit' }
    | {
        type: 'close';
      }
    | { type: 'back' }
    | { type: 'restart' }
};

export const feedbackMachine = createMachine({
  id: 'feedback',
  initial: 'prompt',
  schema,
  context: {
    feedback: ''
  },
  states: {
    prompt: {
      on: {
        'feedback.good': 'thanks',
        'feedback.bad': 'form'
      }
    },
    form: {
      on: {
        'feedback.update': {
          actions: assign({
            feedback: (_, event) => event.value
          })
        },
        back: { target: 'prompt' },
        submit: {
          cond: (ctx) => ctx.feedback.length > 0,
          target: 'thanks'
        }
      }
    },
    thanks: {},
    closed: {
      on: {
        restart: 'prompt'
      }
    }
  },
  on: {
    close: 'closed'
  }
});

it('whatever', () => {
  const p = getMachineShortestPaths(feedbackMachine, {
    events: [{ type: 'feedback.update', value: 'not good' }],
    toState: (state) =>
      state.value === 'closed' && state.context.feedback === 'not good'
  });

  console.log(p);
});

it('tweets', () => {
  const observations = [
    {
      state: { value: 'timeline' },
      event: { type: 'click tweet button' },
      nextState: { value: 'new tweet modal' }
    },
    {
      state: { value: 'new tweet modal' },
      event: { type: 'click modal tweet button' },
      nextState: { value: 'new tweet modal' }
    },
    {
      state: { value: 'new tweet modal' },
      event: { type: 'type tweet in modal' },
      nextState: { value: 'new tweet modal', context: { tweet: 'some tweet' } }
    },
    {
      state: { value: 'new tweet modal', context: { tweet: 'some tweet' } },
      event: { type: 'click modal tweet button' },
      nextState: { value: 'tweeted' }
    },
    {
      state: { value: 'timeline' },
      event: { type: 'type tweet' },
      nextState: { value: 'timeline', context: { tweet: 'some tweet' } }
    },
    {
      state: { value: 'timeline', context: { tweet: 'some tweet' } },
      event: { type: 'click timeline tweet button' },
      nextState: { value: 'tweeted' }
    }
  ];

  const p = getShortestPaths(
    {
      transition: (state, event) => {
        const matchingObservation = observations.find((o) => {
          return (
            o.state.value === state.value &&
            o.state.context?.tweet === state.context?.tweet &&
            o.event.type === event.type
          );
        });

        if (!matchingObservation) {
          return state;
        }

        return matchingObservation.nextState;
      },
      initialState: {
        value: 'timeline',
        context: { tweet: undefined }
      } as { value: string; context?: { tweet?: string } }
    },
    {
      toState: (state) => state.value === 'tweeted',
      events: [
        { type: 'click tweet button' },
        { type: 'click modal tweet button' },
        { type: 'type tweet in modal' },
        { type: 'type tweet' },
        { type: 'click timeline tweet butto' }
      ]
    }
  );

  // Exploration:
  // 1. Record raw state of environment
  // 2. Determine which actions can be performed
  // 3. Try each action
  // 4. Goto 1 (record raw state of environment)
  // 5. When all actions are exhausted, distill raw states into finite states
  //   Use ML to look for patterns in states (this is the beginning of reasoning and understanding)
  //   This is also generalization

  // "Conflicting" observations are really branching observations
  //   If S1 + A = Sm and S2 + A = Sn, determine difference between S1 and S2
  //   Difference contributes to "guarded transition"

  console.log(p);
});
