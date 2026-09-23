import { createAsyncLogic, setup, types } from 'xstate';
import { RMEpisode } from '../../common/types';
import { RickCharacters } from '../../services/RickApi';

/**
 * The clue lookup for one character, as an actor rather than an effect: the
 * request belongs to a state the component reads, so a late response cannot
 * land on an unmounted component and a failure is a state instead of a
 * swallowed rejection.
 */
export const clueMachine = setup({
  schemas: {
    context: types<{ url: string; episode: RMEpisode | null }>(),
    input: types<{ url: string }>()
  },
  actors: {
    loadClue: createAsyncLogic({
      run: ({ input }: { input: { url: string } }) =>
        RickCharacters.getClue(input.url)
    })
  }
}).createMachine({
  id: 'clueMachine',
  context: ({ input }) => ({ url: input.url, episode: null }),
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: 'loadClue',
        input: ({ context }) => ({ url: context.url }),
        onDone: ({ event }) => ({
          target: 'loaded',
          context: { episode: event.output }
        }),
        onError: { target: 'failed' }
      }
    },
    // A clue is optional help, so a failure stays silent: the button simply
    // does not appear.
    failed: {},
    loaded: {}
  }
});
