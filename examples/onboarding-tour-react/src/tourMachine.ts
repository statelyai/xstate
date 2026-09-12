import { setup, types } from 'xstate';

export const STORAGE_KEY = 'onboarding-tour-completed';

export type TourStep = {
  target: string;
  title: string;
  body: string;
};

export const steps: TourStep[] = [
  {
    target: 'sidebar',
    title: 'Your workspace',
    body: 'Every project you belong to lives in this sidebar.'
  },
  {
    target: 'search',
    title: 'Search anything',
    body: 'Find documents, people, and settings from one box.'
  },
  {
    target: 'save',
    title: 'Save your work',
    body: 'Changes are drafts until you save them here.'
  },
  {
    target: 'avatar',
    title: 'Your account',
    body: 'Profile, theme, and billing are behind your avatar.'
  }
];

const LAST_STEP = steps.length - 1;

type TourContext = { step: number };

function markCompleted() {
  localStorage.setItem(STORAGE_KEY, '1');
}

export const tourMachine = setup({
  schemas: {
    context: types<TourContext>(),
    events: {
      next: types<{}>(),
      prev: types<{}>(),
      skip: types<{}>(),
      pause: types<{}>(),
      resume: types<{}>()
    }
  },
  delays: { autoAdvance: 4000 }
}).createMachine({
  id: 'tour',
  context: { step: 0 },
  initial: 'checking',
  states: {
    // Read the persisted flag once, then branch without waiting for an event.
    checking: {
      always: () =>
        localStorage.getItem(STORAGE_KEY) === '1'
          ? { target: 'idle' }
          : { target: 'running' }
    },
    running: {
      initial: 'playing',
      on: {
        skip: { target: 'skipped', actions: markCompleted },
        prev: ({ context }) =>
          context.step > 0
            ? { context: { step: context.step - 1 } }
            : undefined,
        next: ({ context }) =>
          context.step < LAST_STEP
            ? { context: { step: context.step + 1 } }
            : { target: 'done', actions: markCompleted }
      },
      states: {
        playing: {
          // The tour walks itself forward until the user takes over.
          after: { autoAdvance: { target: 'advancing' } },
          on: { pause: { target: 'paused' } }
        },
        // A transient state that reuses the parent's `next` handling.
        advancing: {
          always: ({ context }) =>
            context.step < LAST_STEP
              ? { target: 'playing', context: { step: context.step + 1 } }
              : { target: '#tour.done', actions: markCompleted }
        },
        paused: {
          on: { resume: { target: 'playing' } }
        }
      }
    },
    done: {},
    skipped: {},
    // The tour already ran in an earlier session.
    idle: {}
  }
});
