import { createCallbackLogic, setup, types } from 'xstate';

export interface Question {
  prompt: string;
  choices: string[];
  /** Index into `choices`. */
  answer: number;
}

export const questions: Question[] = [
  {
    prompt: 'Which state does a machine enter first?',
    choices: ['The last one', 'Its initial state', 'A random one'],
    answer: 1
  },
  {
    prompt: 'What cancels a delayed (`after`) transition?',
    choices: ['Leaving the state', 'Nothing', 'Sending any event'],
    answer: 0
  },
  {
    prompt: 'Where does data that is not a finite state live?',
    choices: ['In the state value', 'In context', 'In the event'],
    answer: 1
  },
  {
    prompt: 'What makes states run at the same time?',
    choices: ['`type: "parallel"`', '`type: "final"`', '`always`'],
    answer: 0
  }
];

/** Question time limit, in seconds. */
const QUESTION_SECONDS = 15;

export interface QuizContext {
  index: number;
  score: number;
  /** Seconds elapsed on the current question, for the countdown display. */
  elapsed: number;
  /** One entry per question: the chosen index, or `null` if skipped. */
  answers: (number | null)[];
}

const initialContext: QuizContext = {
  index: 0,
  score: 0,
  elapsed: 0,
  answers: []
};

export const secondsLeft = (context: QuizContext) =>
  Math.max(0, QUESTION_SECONDS - context.elapsed);

/**
 * Records an answer and moves on: back into `answering` for the next question
 * (which restarts the timer and the ticker), or to `results` at the end.
 */
const advance = (context: QuizContext, choice: number | null) => {
  const correct = choice === questions[context.index]!.answer;
  const next = {
    index: context.index + 1,
    score: context.score + (correct ? 1 : 0),
    elapsed: 0,
    answers: [...context.answers, choice]
  };

  return {
    target: next.index >= questions.length ? 'results' : 'answering',
    // Re-entering `answering` restarts its deadline and its ticker.
    reenter: true,
    context: next
  };
};

export const quizMachine = setup({
  schemas: {
    context: types<QuizContext>(),
    events: {
      answer: types<{ choice: number }>(),
      skip: types<{}>(),
      restart: types<{}>(),
      TICK: types<{}>()
    }
  },
  actors: {
    // Drives the countdown display only. The deadline itself is the `after`
    // transition below, so the two never disagree about when time is up.
    seconds: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => sendBack({ type: 'TICK' }), 1000);
      return () => clearInterval(interval);
    })
  },
  delays: {
    questionTime: QUESTION_SECONDS * 1000
  }
}).createMachine({
  id: 'quiz',
  context: initialContext,
  initial: 'answering',
  states: {
    answering: {
      invoke: { src: 'seconds' },
      after: {
        // Running out of time counts as a skip.
        questionTime: ({ context }) => advance(context, null)
      },
      on: {
        TICK: ({ context }) => ({ context: { elapsed: context.elapsed + 1 } }),
        answer: ({ context, event }) => advance(context, event.choice),
        skip: ({ context }) => advance(context, null)
      }
    },
    results: {
      on: {
        restart: () => ({ target: 'answering', context: initialContext })
      }
    }
  }
});
