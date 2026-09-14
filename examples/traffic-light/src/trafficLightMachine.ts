import { setup, types } from 'xstate';

/**
 * A traffic light with three lamps, a pedestrian button, and a fault mode.
 *
 * The light cycles green -> yellow -> red -> green on delayed transitions.
 * Pressing the pedestrian button while the light is green cuts the green
 * phase short. A fault switches the whole machine into a flashing mode that
 * runs two independent regions in parallel.
 */
export const trafficLightMachine = setup({
  schemas: {
    context: types<{
      /** Set when a pedestrian pressed the button, cleared when they cross. */
      pedestrianWaiting: boolean;
      /** How many full cycles the light has completed. */
      cycles: number;
    }>(),
    events: {
      pedestrianRequest: types<{}>(),
      fault: types<{}>(),
      reset: types<{}>()
    }
  },
  // Named delays keep the timing in one place, and can be overridden in tests.
  delays: {
    greenDuration: 6000,
    yellowDuration: 2000,
    redDuration: 5000,
    flash: 500,
    beep: 800
  }
}).createMachine({
  id: 'trafficLight',
  context: {
    pedestrianWaiting: false,
    cycles: 0
  },
  initial: 'operating',
  states: {
    /** Normal service: a single sequential cycle through the three lamps. */
    operating: {
      initial: 'green',
      states: {
        green: {
          // A delayed transition: after `greenDuration` ms in this state,
          // move to `yellow`. Leaving the state early cancels the timer.
          after: {
            greenDuration: { target: 'yellow' }
          },
          on: {
            // The button races the delayed transition: whichever happens
            // first wins, so a request ends the green phase immediately.
            pedestrianRequest: () => ({
              target: 'yellow',
              context: { pedestrianWaiting: true }
            })
          }
        },
        yellow: {
          after: {
            yellowDuration: { target: 'red' }
          }
        },
        red: {
          // Pedestrians cross while the light is red.
          entry: ({ context }) => ({
            context: { pedestrianWaiting: false, cycles: context.cycles + 1 }
          }),
          after: {
            redDuration: { target: 'green' }
          }
        }
      },
      on: {
        // Declared on the parent, so a fault interrupts any lamp.
        fault: { target: 'fault' }
      }
    },
    /**
     * Fault mode. Two regions run at the same time and keep their own
     * independent timers: the lamp flashes twice as often as the buzzer beeps.
     */
    fault: {
      type: 'parallel',
      states: {
        lamp: {
          initial: 'on',
          states: {
            on: { after: { flash: { target: 'off' } } },
            off: { after: { flash: { target: 'on' } } }
          }
        },
        buzzer: {
          initial: 'silent',
          states: {
            silent: { after: { beep: { target: 'beeping' } } },
            beeping: { after: { beep: { target: 'silent' } } }
          }
        }
      },
      on: {
        // Re-entering `operating` restarts it at its initial state, `green`.
        reset: { target: 'operating' }
      }
    }
  }
});
