# Task 4: Timer

This is the fourth of [The 7 Tasks from 7GUIs](https://eugenkiss.github.io/7guis/tasks#timer):

> Challenges: concurrency, competing user/signal interactions, responsiveness.
>
> The task is to build a frame containing a gauge G for the elapsed time e, a label which shows the elapsed time as a numerical value, a slider S by which the duration d of the timer can be adjusted while the timer is running and a reset button R. Adjusting S must immediately reflect on d and not only when S is released. It follows that while moving S the filled amount of G will (usually) change immediately. When e ≥ d is true then the timer stops (and G will be full). If, thereafter, d is increased such that d > e will be true then the timer restarts to tick until e ≥ d is true again. Clicking R will reset e to zero.
>
> Timer deals with concurrency in the sense that a timer process that updates the elapsed time runs concurrently to the user’s interactions with the GUI application. This also means that the solution to competing user and signal interactions is tested. The fact that slider adjustments must be reflected immediately moreover tests the responsiveness of the solution. A good solution will make it clear that the signal is a timer tick and, as always, has not much scaffolding.
>
> Timer is directly inspired by the timer example in the paper [Crossing State Lines: Adapting Object-Oriented Frameworks to Functional Reactive Languages](http://cs.brown.edu/~sk/Publications/Papers/Published/ick-adapt-oo-fwk-frp/paper.pdf).

## Modeling

The key point in modeling this timer is in the description itself:

> A good solution will make it clear that **the signal is a timer tick**

Indeed, we can model timer ticks as a signal (event) that updates the context of some parent timer machine. The timer can be in either the `paused` state or the `running` state, and these timer ticks should ideally only be active when the machine is in the `running` state. This gives us a good basis for how we can model the other requirements:

- When in the `running` state, some `elapsed` variable is incremented by some `interval` on every `TICK` event.
- Always check that `elapsed` does not exceed `duration` (guarded transition) in the `running` state (transient transition)
  - If `elapsed` exceeds `duration`, transition to the `paused` state.
- Always check that `duration` does not exceed `elapsed` (guarded transition) in the `paused` state.
  - If `duration` exceeds `elapsed`, transition to the `running` state.
- The `duration` can always be updated via some `DURATION.UPDATE` event.
- A `RESET` event resets `elapsed` to `0`.

In the `running` state, we can invoke a service that calls `setInterval(...)` to send a `TICK` event on the desired `interval`.

By modeling everything as a "signal" (event), such as `DURATION.UPDATE`, `TICK`, `RESET`, etc., the interface is fully reactive and concurrent. It also simplifies the implementation.

**States:**

- `"running"` - the state where the timer is running, receiving `TICK` events from some invoked interval service, and updating `context.elapsed`.
- `"paused"` - the state where the timer is not running and no longer receiving `TICK` events.

**Context:**

```ts
interface TimerContext {
  // The elapsed time (in seconds)
  elapsed: number;
  // The maximum time (in seconds)
  duration: number;
  // The interval to send TICK events (in seconds)
  interval: number;
}
```

**Events:**

```ts
type TimerEvent =
  | {
      // The TICK event sent by the spawned interval service
      type: 'TICK';
    }
  | {
      // User intent to update the duration
      type: 'DURATION.UPDATE';
      value: number;
    }
  | {
      // User intent to reset the elapsed time to 0
      type: 'RESET';
    };
```

## Coding

```js
export const timerMachine = createMachine({
  initial: 'running',
  context: {
    elapsed: 0,
    duration: 5,
    interval: 0.1
  },
  states: {
    running: {
      invoke: {
        src: (context) => (cb) => {
          const interval = setInterval(() => {
            cb('TICK');
          }, 1000 * context.interval);

          return () => {
            clearInterval(interval);
          };
        }
      },
      on: {
        '': {
          target: 'paused',
          cond: (context) => {
            return context.elapsed >= context.duration;
          }
        },
        TICK: {
          actions: assign({
            elapsed: (context) =>
              +(context.elapsed + context.interval).toFixed(2)
          })
        }
      }
    },
    paused: {
      on: {
        '': {
          target: 'running',
          cond: (context) => context.elapsed < context.duration
        }
      }
    }
  },
  on: {
    'DURATION.UPDATE': {
      actions: assign({
        duration: (_, event) => event.value
      })
    },
    RESET: {
      actions: assign({
        elapsed: 0
      })
    }
  }
});
```

## Result

<iframe
  src="https://codesandbox.io/embed/7guis-timer-2gzst?fontsize=14&hidenavigation=1&theme=dark"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
  title="7GUIs: Timer"
  allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
  sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
></iframe>
