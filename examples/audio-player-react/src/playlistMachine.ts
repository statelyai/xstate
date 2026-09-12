import { createCallbackLogic, setup, types } from 'xstate';

export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
}

export const tracks: Track[] = [
  { id: 'a', title: 'Parallel States', artist: 'The Actors', duration: 8 },
  { id: 'b', title: 'Guardless', artist: 'The Actors', duration: 6 },
  { id: 'c', title: 'Spawn Point', artist: 'Hierarchy', duration: 10 },
  { id: 'd', title: 'Always On', artist: 'Hierarchy', duration: 5 }
];

const nextIndex = (index: number, shuffle: boolean) => {
  if (!shuffle) {
    return (index + 1) % tracks.length;
  }

  const others = tracks.map((_, i) => i).filter((i) => i !== index);

  return others[Math.floor(Math.random() * others.length)];
};

export const playlistMachine = setup({
  schemas: {
    context: types<{ index: number; elapsed: number; shuffle: boolean }>(),
    events: {
      PLAY: types<{}>(),
      PAUSE: types<{}>(),
      NEXT: types<{}>(),
      PREV: types<{}>(),
      SELECT: types<{ index: number }>(),
      TOGGLE_SHUFFLE: types<{}>(),
      TICK: types<{}>()
    }
  },
  actors: {
    clock: createCallbackLogic(({ sendBack }) => {
      const interval = setInterval(() => sendBack({ type: 'TICK' }), 1000);

      return () => clearInterval(interval);
    })
  }
}).createMachine({
  id: 'playlist',
  initial: 'paused',
  context: { index: 0, elapsed: 0, shuffle: false },
  states: {
    paused: {
      on: {
        PLAY: { target: 'playing' }
      }
    },
    playing: {
      invoke: { src: 'clock' },
      on: {
        PAUSE: { target: 'paused' },
        TICK: ({ context }) => ({
          context: { elapsed: context.elapsed + 1 }
        })
      },
      // Auto-advance: the track ran out, so move to the next one and keep playing
      always: ({ context }) => {
        if (context.elapsed < tracks[context.index].duration) {
          return;
        }

        return {
          context: {
            index: nextIndex(context.index, context.shuffle),
            elapsed: 0
          }
        };
      }
    }
  },
  on: {
    NEXT: ({ context }) => ({
      context: {
        index: nextIndex(context.index, context.shuffle),
        elapsed: 0
      }
    }),
    PREV: ({ context }) => ({
      context: {
        index: (context.index - 1 + tracks.length) % tracks.length,
        elapsed: 0
      }
    }),
    SELECT: ({ event }) => ({
      target: '.playing',
      context: { index: event.index, elapsed: 0 }
    }),
    TOGGLE_SHUFFLE: ({ context }) => ({
      context: { shuffle: !context.shuffle }
    })
  }
});
