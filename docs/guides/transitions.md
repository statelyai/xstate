# Transitions

Transitions define how the machine reacts to [events](./events.md). To learn more, see the section in our [introduction to statecharts](./introduction-to-state-machines-and-statecharts/index.md#transitions-and-events).

## API

State transitions are defined on state nodes, in the `on` property:

```js {11,14-16}
import { createMachine } from 'xstate';

const promiseMachine = createMachine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {
      on: {
        // state transition (shorthand)
        // this is equivalent to { target: 'resolved' }
        RESOLVE: 'resolved',

        // state transition (object)
        REJECT: {
          target: 'rejected'
        }
      }
    },
    resolved: {
      type: 'final'
    },
    rejected: {
      type: 'final'
    }
  }
});

const { initialState } = promiseMachine;

console.log(initialState.value);
// => 'pending'

const nextState = promiseMachine.transition(initialState, { type: 'RESOLVE' });

console.log(nextState.value);
// => 'resolved'
```

In the above example, when the machine is in the `pending` state and it receives a `RESOLVE` event, it will transition to the `resolved` state.

A state transition can be defined as:

- a string, e.g., `RESOLVE: 'resolved'`, which is equivalent to...
- an object with a `target` property, e.g., `RESOLVE: { target: 'resolved' }`,
- an array of transition objects, which are used for conditional transitions (see [guards](./guards.md))

## Selecting Enabled Transitions

An **enabled transition** is a transition that will be taken conditionally, based upon the current state and event. It will be taken if and only if:

- it is defined on a [state node](./statenodes.md) that matches the current state value
- the transition [guard](./guards.md) (`cond` property) is satisfied (evaluates to `true`)
- it is not superseded by a more specific transition.

In a [hierarchical machine](./hierarchical.md), transitions are prioritized by how deep they are in the tree; deeper transitions are more specific and thus have higher priority. This works similar to how DOM events work: if you click a button, the click event handler directly on the button is more specific than a click event handler on the `window`.

```js {10,21-22,27}
const wizardMachine = createMachine({
  id: 'wizard',
  initial: 'open',
  states: {
    open: {
      initial: 'step1',
      states: {
        step1: {
          on: {
            NEXT: { target: 'step2' }
          }
        },
        step2: {
          /* ... */
        },
        step3: {
          /* ... */
        }
      },
      on: {
        NEXT: { target: 'goodbye' },
        CLOSE: { target: 'closed' }
      }
    },
    goodbye: {
      on: {
        CLOSE: { target: 'closed' }
      }
    },
    closed: {
      type: 'final'
    }
  }
});

// { open: 'step1' }
const { initialState } = wizardMachine;

// the NEXT transition defined on 'open.step1'
// supersedes the NEXT transition defined
// on the parent 'open' state
const nextStepState = wizardMachine.transition(initialState, { type: 'NEXT' });
console.log(nextStepState.value);
// => { open: 'step2' }

// there is no CLOSE transition on 'open.step1'
// so the event is passed up to the parent
// 'open' state, where it is defined
const closedState = wizardMachine.transition(initialState, { type: 'CLOSE' });
console.log(closedState.value);
// => 'closed'
```

## Event Descriptors

An event descriptor is a string describing the event type that the transition will match. Often, this is equivalent to the `event.type` property on the `event` object sent to the machine:

```js
// ...
{
  on: {
    // "CLICK" is the event descriptor.
    // This transition matches events with { type: 'CLICK' }
    CLICK: 'someState',
    // "SUBMIT" is the event descriptor.
    // This transition matches events with { type: 'SUBMIT' }
    SUBMIT: 'anotherState'
  }
}
// ...
```

Other event descriptors include:

- [Null event descriptors](#transient-transitions) (`""`), which match no events (i.e., "null" events) and represent transitions taken immediately after the state is entered
- [Wildcard event descriptors](#wildcard-descriptors) (`"*"`) <Badge text="4.7+" />, which match any event if the event is not matched explicitly by any other transition in the state

## Self Transitions

A self-transition is when a state transitions to itself, in which it _may_ exit and then reenter itself. Self-transitions can either be an **internal** or **external** transition:

- An **internal transition** will not exit nor re-enter itself, but may enter different child states.
- An **external transition** will exit and re-enter itself, and may also exit/enter child states.

By default, all transitions with a specified target are external.

See [actions on self-transitions](./actions.md#actions-on-self-transitions) for more details on how entry/exit actions are executed on self-transitions.

## Transient Transitions

::: warning
The empty string syntax (`{ on: { '': ... } }`) will be deprecated in version 5. The new `always` syntax in version 4.11+ should be preferred. See below section on [eventless transitions](#eventless-always-transitions), which are the same as transient transitions.
:::

A transient transition is a transition that is enabled by a [null event](./events.md#null-events). In other words, it is a transition that is _immediately_ taken (i.e., without a triggering event) as long as any conditions are met:

```js {14-17}
const gameMachine = createMachine(
  {
    id: 'game',
    initial: 'playing',
    context: {
      points: 0
    },
    states: {
      playing: {
        on: {
          // Transient transition
          // Will transition to either 'win' or 'lose' immediately upon
          // (re)entering 'playing' state if the condition is met.
          '': [
            { target: 'win', cond: 'didPlayerWin' },
            { target: 'lose', cond: 'didPlayerLose' }
          ],
          // Self-transition
          AWARD_POINTS: {
            actions: assign({
              points: 100
            })
          }
        }
      },
      win: { type: 'final' },
      lose: { type: 'final' }
    }
  },
  {
    guards: {
      didPlayerWin: (context, event) => {
        // check if player won
        return context.points > 99;
      },
      didPlayerLose: (context, event) => {
        // check if player lost
        return context.points < 0;
      }
    }
  }
);

const gameService = interpret(gameMachine)
  .onTransition((state) => console.log(state.value))
  .start();

// Still in 'playing' state because no conditions of
// transient transition were met
// => 'playing'

// When 'AWARD_POINTS' is sent, a self-transition to 'PLAYING' occurs.
// The transient transition to 'win' is taken because the 'didPlayerWin'
// condition is satisfied.
gameService.send('AWARD_POINTS');
// => 'win'
```

Just like transitions, transient transitions can be specified as a single transition (e.g., `'': 'someTarget'`), or an array of conditional transitions. If no conditional transitions on a transient transition are met, the machine stays in the same state.

Null events are always "sent" for every transition, internal or external.

## Forbidden Transitions

In XState, a "forbidden" transition is one that specifies that no state transition should occur with the specified event. That is, nothing should happen on a forbidden transition, and the event should not be handled by parent state nodes.

A forbidden transition is made by specifying the `target` explicitly as `undefined`. This is the same as specifying it as an internal transition with no actions:

```js {3}
on: {
  // forbidden transition
  LOG: undefined,
  // same thing as...
  LOG: {
    actions: []
  }
}
```

For example, we can model that telemetry can be logged for all events except when the user is entering personal information:

```js {15}
const formMachine = createMachine({
  id: 'form',
  initial: 'firstPage',
  states: {
    firstPage: {
      /* ... */
    },
    secondPage: {
      /* ... */
    },
    userInfoPage: {
      on: {
        // explicitly forbid the LOG event from doing anything
        // or taking any transitions to any other state
        LOG: undefined
      }
    }
  },
  on: {
    LOG: {
      actions: 'logTelemetry'
    }
  }
});
```

::: tip

Note that when defining multiple transitions with the same event name in a hierarchical ancestor-descendant chain, the most inner transition will exclusively be taken. In the example above, this is why the `logTelemetry` action defined in the parent `LOG` event won't execute as soon as the machine reaches the `userInfoPage` state.

:::

## FAQ's

### How do I do if/else logic on transitions?

Sometimes, you'll want to say:

- If _something_ is true, go to this state
- If _something else_ is true, go to this state
- Else, go to this state

You can use [guarded transitions](./guards.md#guarded-transitions) to achieve this.

### How do I transition to _any_ state?

You can transition to _any_ state by giving that state a custom id, and using `target: '#customId'`. You can read the [full docs on custom IDs here](./ids.md#custom-ids).

This allows you to transition from child states to siblings of parents, for example in the `CANCEL` and `done` events in this example:

<iframe src="https://stately.ai/viz/embed/835aee58-1c36-41d3-bb02-b56ceb06072e?mode=viz&panel=code&readOnly=1&showOriginalLink=1&controls=0&pan=0&zoom=0"
allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>
