import { setup, types } from 'xstate';

/**
 * A settings panel with three tabs. The `advanced` tab has its own
 * sub-sections, which is what makes the difference between shallow and deep
 * history visible.
 *
 * Closing the panel exits `open`, so its child states are forgotten — unless
 * the panel is reopened through a history state, which restores what was
 * active when `open` was last exited.
 */
export const settingsMachine = setup({
  schemas: {
    context: types<{ opens: number }>(),
    events: {
      close: types<{}>(),
      // Reopens at the initial tab, throwing away where the user was.
      open: types<{}>(),
      // Reopens at the last tab, but that tab starts at its own initial state.
      openShallow: types<{}>(),
      // Reopens at the last tab *and* its last sub-section.
      openDeep: types<{}>(),
      selectTab: types<{ tab: 'general' | 'appearance' | 'advanced' }>(),
      selectSection: types<{ section: 'network' | 'experiments' }>()
    }
  }
}).createMachine({
  id: 'settings',
  context: { opens: 1 },
  initial: 'open',
  states: {
    closed: {
      on: {
        open: { target: 'open' },
        // A history state is targeted like any other state node.
        openShallow: { target: 'open.lastTab' },
        openDeep: { target: 'open.lastTabAndSection' }
      }
    },
    open: {
      entry: ({ context }) => ({ context: { opens: context.opens + 1 } }),
      initial: 'general',
      states: {
        general: {},
        appearance: {},
        advanced: {
          initial: 'network',
          states: {
            network: {},
            experiments: {}
          },
          on: {
            selectSection: ({ event }) => ({ target: `.${event.section}` })
          }
        },
        /**
         * Shallow history: remembers which tab was active, but each tab
         * re-enters at its own `initial` state. Reopening on `advanced`
         * therefore lands on `advanced.network`, not on the last sub-section.
         *
         * `target` is the default used the first time, before anything has
         * been recorded. XState v6 requires it.
         */
        lastTab: {
          type: 'history',
          history: 'shallow',
          target: 'general'
        },
        /** Deep history: remembers the full configuration below `open`. */
        lastTabAndSection: {
          type: 'history',
          history: 'deep',
          target: 'general'
        }
      },
      on: {
        selectTab: ({ event }) => ({ target: `.${event.tab}` }),
        close: { target: 'closed' }
      }
    }
  }
});
