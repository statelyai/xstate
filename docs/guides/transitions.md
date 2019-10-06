# Transitions

A state transition defines what the **next state** is, given the **current state** and [**event**](./events.md). State transitions are defined on state nodes, in the `on` property:

```js {11,14-16}
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

```js {8}
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

```js {9,19,20,24}
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

## Internal Transitions

An internal transition is one that does not exit its state node. Internal transitions are created by specifying a [relative target](./ids.md#relative-targets) (e.g., `'.left'`) or by explicitly setting `{ internal: true }` on the transition. For example, consider a machine that sets a paragraph of text to align `'left'`, `'right'`, `'center'`, or `'justify'`:

```js {14-17}
import { Machine } from 'xstate';

const wordMachine = Machine({
  id: 'word',
  initial: 'left',
  states: {
    left: {},
    right: {},
    center: {},
    justify: {}
  },
  on: {
    // internal transitions
    LEFT_CLICK: '.left',
    RIGHT_CLICK: { target: '.right' }, // same as '.right'
    CENTER_CLICK: { target: '.center', internal: true }, // same as '.center'
    JUSTIFY_CLICK: { target: 'word.justify', internal: true } // same as '.justify'
  }
});
```

The above machine will start in the `'left'` state (for reference, the full path and default ID is `'word.left'`), and based on what is clicked, will internally transition to its other child states. Also, since the transitions are internal, `entry`, `exit` or any of the `actions` defined on the parent state node are not executed again.

Transitions that have `{ target: undefined }` (or no `target`) are also internal transitions:

```js {11-13}
const buttonMachine = Machine({
  id: 'button',
  initial: 'inactive',
  states: {
    inactive: {
      on: { PUSH: 'active' }
    },
    active: {
      on: {
        // No target - internal transition
        PUSH: {
          actions: 'logPushed'
        }
      }
    }
  }
});
```

**Summary of internal transitions:**

- `EVENT: '.foo'` - internal transition to child
- `EVENT: { target: '.foo' }` - internal transition to child (starts with `'.'`)
- `EVENT: { target: 'same.foo', internal: true }` - explicit internal transition to own child node (equivalent to `{ target: '.foo' }`)
  - This would otherwise be an external transition
- `EVENT: undefined` - forbidden transition
- `EVENT: { actions: [ ... ] }` - internal self-transition
- `EVENT: { actions: [ ... ], internal: true }` - internal self-transition, same as above
- `EVENT: { target: undefined, actions: [ ... ] }` - internal self-transition, same as above

## External Transitions

External transitions _will_ exit and reenter the state node in which the transition is defined. In the above example, the parent `word` state node (the root state node) will have its `exit` and `entry` actions executed on its transitions.

By default, transitions are external, but any transition can be made external by explicitly setting `{ internal: false }` on the transition.

```js {4-7}
// ...
on: {
  // external transitions
  LEFT_CLICK: 'word.left',
  RIGHT_CLICK: 'word.right',
  CENTER_CLICK: { target: '.center', internal: false }, // same as 'word.center'
  JUSTIFY_CLICK: { target: 'word.justify', internal: false } // same as 'word.justify'
}
// ...
```

Every transition above is explicit and will have its `exit` and `entry` actions of the parent state executed.

**Summary of external transitions:**

- `EVENT: { target: 'foo' }` - all transitions to siblings are external transitions
- `EVENT: { target: '#someTarget' }` - all transitions to other nodes are external transitions
- `EVENT: { target: 'same.foo' }` - external transition to own child node (equivalent to `{ target: '.foo', internal: false }`)
- `EVENT: { target: '.foo', internal: false }` - external transition to child node
  - This would otherwise be an internal transition
- `EVENT: { actions: [ ... ], internal: false }` - external self-transition
- `EVENT: { target: undefined, actions: [ ... ], internal: false }` - external self-transition, same as above

## Transient Transitions

A transient transition is a transition that is enabled by a [null event](./events.md#null-events). In other words, it is a transition that is _immediately_ taken (i.e., without a triggering event) as long as any conditions are met:

```js {14-17}
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

```js {23}
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
    DEACTIVATE: {
      target: ['.mode.inactive', '.status.disabled']
    }
  }
});
```

## Wildcard Descriptors

A transition that is specified with a wildcard event descriptor (`"*"`) is activated by _any event_. This means that any event will match the transition that has `on: { "*": ... }`, and if the guards pass, that transition will be taken.

Explicit event descriptors will always be chosen over wildcard event descriptors, unless the transitions are specified in an array. In that case, the order of the transitions determines which transition gets chosen.

```js {3,8}
// For SOME_EVENT, the explicit transition to "here" will be taken
on: {
  "*": "elsewhere",
  "SOME_EVENT": "here"
}

// For SOME_EVENT, the wildcard transition to "elsewhere" will be taken
on: [
  { event: "*", target: "elsewhere" },
  { event: "SOME_EVENT", target: "here" },
]
```

::: tip

Wildcard descriptors do _not_ behave the same way as [transient transitions](#transient-transitions) (with null event descriptors). Whereas transient transitions will be taken immediately whenever the state is active, wildcard transitions still need some event to be sent to its state to be triggered.

:::

**Example:**

```js {7,8}
const quietMachine = Machine({
  id: 'quiet',
  initial: 'idle',
  states: {
    idle: {
      on: {
        WHISPER: undefined,
        // On any event besides a WHISPER, transition to the 'disturbed' state
        '*': 'disturbed'
      }
    },
    disturbed: {}
  }
});

quietMachine.transition(quietMachine.initialState, 'WHISPER');
// => State { value: 'idle' }

quietMachine.transition(quietMachine.initialState, 'SOME_EVENT');
// => State { value: 'disturbed' }
```

## SCXML

The event-target mappings defined on the `on: { ... }` property of state nodes is synonymous to the SCXML `<transition>` element:

```js
{
  green: {
    on: {
      TIMER: {
        target: '#yellow',
        cond: context => context.timeElapsed > 5000
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
