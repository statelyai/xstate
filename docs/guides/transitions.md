# Transitions

A state transition defines what the **next state** is, given the **current state** and [**event**](./events.md). State transitions are defined on state nodes, in the `on` property:

```js
import { Machine } from 'xstate';

const promiseMachine = Machine({
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

const nextState = promiseMachine.transition(initialState, 'RESOLVE');

console.log(nextState.value);
// => 'resolved'
```

In the above example, when the machine is in the `pending` state and it receives a `RESOLVE` event, it will transition to the `resolved` state.

A state transition can be defined as:

- a string, e.g., `RESOLVE: 'resolved'`, which is equivalent to...
- an object with a `target` property, e.g., `RESOLVE: { target: 'resolved' }`,
- an array of transition objects, which are used for conditional transitions (see [guards](./guards.md))

## Machine `.transition` Method

As seen above, the `machine.transition(...)` method is a pure function that takes two arguments:

- `state` - the [State](./states.md) to transition from
- `event` - the [event](./events.md) that causes the transition

It returns a new [`State` instance](./states.md#state-definition), which is the result of taking all the transitions enabled by the current state and event.

```js
const lightMachine = Machine({
  /* ... */
});

const greenState = lightMachine.initialState;

// determine next state based on current state and event
const yellowState = lightMachine.transition(greenState, { type: 'TIMER' });

console.log(yellowState.value);
// => 'yellow'
```

## Selecting Enabled Transitions

An **enabled transition** is a transition that will be taken, given the current state and event. It will be taken if and only if:

- it is defined on a [state node](./statenodes.md) that matches the current state value
- the transition [guard](./guards.md) (`cond` property) is satisfied (evaluates to `true`)
- it is not superseded by a more specific transition.

In a [hierarchical machine](./hierarchical.md), transitions are prioritized by how deep they are in the tree; deeper transitions are more specific and thus have higher priority. This works similar to how DOM events work: if you click a button, the click event handler directly on the button is more specific than a click event handler on the `window`.

```js
const wizardMachine = Machine({
  id: 'wizard',
  initial: 'open',
  states: {
    open: {
      initial: 'step1',
      states: {
        step1: {
          on: { NEXT: 'step2' }
        },
        step2: {
          /* ... */
        },
        step3: {
          /* ... */
        }
      },
      on: {
        NEXT: 'goodbye',
        CLOSE: 'closed'
      }
    },
    goodbye: {
      on: { CLOSE: 'closed' }
    },
    closed: { type: 'final' }
  }
});

// { open: 'step1' }
const { initialState } = wizardMachine;

// the NEXT transition defined on 'open.step1'
// supersedes the NEXT transition defined
// on the parent 'open' state
const nextStepState = wizardMachine.transition(initialState, 'NEXT');
console.log(nextStepState.value);
// => { open: 'step2' }

// there is no CLOSE transition on 'open.step1'
// so the event is passed up to the parent
// 'open' state, where it is defined
const closedState = wizardMachine.transition(initialState, 'CLOSE');
console.log(closedState.value);
// => 'closed'
```

## Self Transitions

A self-transition is when a state transitions to itself, in which it _may_ exit and then reenter itself. Self-transitions can either be an **internal** or **external** transition:

- An **internal transition** will not exit nor re-enter itself, but may enter different child states.
- An **external transition** will exit and re-enter itself, and may also exit/enter child states.

By default, all transitions with a specified target are external.

See [actions on self-transitions](./actions.md#actions-on-self-transitions) for more details on how entry/exit actions are executed on self-transitions.

## Transient Transitions

A transient transition is a transition that is enabled by a [null event](./events.md#null-events). In other words, it is a transition that is _immediately_ taken (i.e., without a triggering event) as long as any conditions are met:

```js
const gameMachine = Machine(
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
  .onTransition(state => console.log(state.value))
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

```js
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

```js
const formMachine = Machine({
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

## Multiple Targets

A transition based on a single event can have multiple target state nodes. This is uncommon, and only valid if the state nodes are legal; e.g., a transition to two sibling state nodes in a compound state node is illegal, since a (non-parallel) state machine can only be in one state at any given time.

Multiple targets are specified as an array in `target: [...]`, where each target in the array is a relative key or an ID to a state node, just like single targets.

```js
const settingsMachine = Machine({
  id: 'settings',
  type: 'parallel',
  states: {
    mode: {
      initial: 'active',
      states: {
        inactive: {},
        pending: {},
        active: {}
      }
    },
    status: {
      initial: 'enabled',
      states: {
        disabled: {},
        enabled: {}
      }
    }
  },
  on: {
    // Multiple targets
    DEACTIVATE: ['.mode.inactive', '.status.disabled']
    // Can also be coded as...
    // DEACTIVATE: {
    //   target: ['.mode.inactive', '.status.disabled']
    // }
  }
});
```

## SCXML

The event-target mappings defined on the `on: { ... }` property of state nodes is synonymous to the SCXML `<transition>` element:

```js
{
  green: {
    on: {
      TIMER: {
        target: '#yellow',
        cond: ctx => ctx.timeElapsed > 5000
      },
      POWER_OUTAGE: '#red.flashing'
    }
  },
  // ...
}
```

```xml
<state id="green">
  <transition
    event="TIMER"
    target="yellow"
    cond="timeElapsed > 5000"
  />
  <transition
    event="POWER_OUTAGE"
    target="red.flashing"
  />
</state>
```

- [https://www.w3.org/TR/scxml/#transition](https://www.w3.org/TR/scxml/#transition) - the definition of `<transition>`
