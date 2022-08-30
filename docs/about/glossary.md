# Glossary

This glossary is a guide to the most common terms in statecharts and state machines.

## State machines

A state machine is a model showing how you transition from state to state in a process when events occur.

State machines make building reliable software easier because they prevent impossible states and undesired transitions.

## Statecharts

Statecharts are a visual language used to visualize state machines. You may have used similar diagrams in the past to design user flows, plan databases or map app architecture. Statecharts are another way of using boxes and arrows to represent flows. These flows are also executable code you can use to control the logic in your applications.

![basic statechart with an initial state transitioning through an event to another state, then transitioning through another event to a final state.](./basic-statechart.png)

## States

A state describes the status of the machine. A state can be as simple as _on_ and _off_. These states are finite; the machine can only move through the pre-defined states. And machines can only be in one state at a time, unless it is a [parent state](#parent-and-child-states) or a [parallel state](#parallel-states).

### Initial state

When a state machine starts, it enters the **initial state** first. The initial state is represented by the <img alt='filled circle with an arrow pointing from the circle to the initial state' src='./initial-state-icon.png' height='24' width='24' style='display: inline; margin-bottom: -5px' /> icon. A machine can only have one initial state.

<!-- What a state might be -->

#### Initial states in child states

Inside a parent state, you must specify which child state is the initial state, which the machine enters automatically when it enters the parent state. The initial state is represented by the <img alt='filled circle with an arrow pointing from the circle to the initial state' src='./initial-state-icon.png' height='24' width='24' style='display: inline; margin-bottom: -5px' /> icon.

<!-- What is a typical initial state -->

### Parent and child states

States can contain more states, also known as child states. These child states can only happen when the parent state is happening.

<!-- Why you might use parent and child states -->

![statechart with an initial state transitioning through an event to a parent state which contains two states. The second state transitions through an event to the final state.](./statechart-with-parent-and-child-states.png)

### Final state

When a machine reaches the final state, it can no longer receive any events, and anything running inside the machine is canceled and cleaned up. The final state is represented by the <img alt='box with a surrounding border' src='./final-state-icon.png' height='24' width='24' style='display: inline; margin-bottom: -6px' /> icon.

A machine can have multiple final states or no final states.

<!-- What makes a typical final state, and when might you have no final states or multiple final states -->

### Parallel states

A parallel state is a parent state that is separated into multiple regions of states, where each region is active simultaneously. Regions are represented by a dashed line around each region.

<!-- Why you might use parallel states -->

![basic statechart with an initial state transitioning through an event to a parallel state which contains two regions. Each region has its own states. There’s an event from the parallel state which ends in the final state.](./statechart-with-parallel-state.png)

### History state

A history state returns the machine to the most recently active state. The history state is represented by the <img alt='box with an H inside' src='./history-state-icon.png' height='24' width='24' style='display: inline; margin-bottom: -6px' /> icon.

The history state can be deep or shallow:

- A shallow history state remembers the immediate child’s state.
- A deep history state remembers the deepest active state or states inside its child states.

The deep history state is represented by the <img alt='box with an H and asterisk inside' src='./deep-history-state-icon.png' height='24' width='24' style='display: inline; margin-bottom: -6px' /> icon.

<!-- What you might use a shallow history state for -->

<!-- What you might use a deep history state for -->

## Transitions and events

A machine moves from state to state through transitions. These transitions are caused by events. Events are deterministic; each combination of state and event always points to the same next state.

<!-- What is a typical event -->

### Guarded transitions

A guard is a condition that the machine checks when it goes through an event. If the condition is true, the machine follows the transition to the next state. If the condition is false, the machine follows the rest of the conditions to the next state. Any transition can be a guarded transition.

<!-- What you might use a guard for -->

### Eventless transitions

Eventless transitions are transitions without events. These transitions **always** run when the machine goes through the event; no event is necessary to trigger the transition. Eventless transitions are labeled “always.”

<!-- What you might use an eventless transition for -->

### Wildcard transitions

Wildcard transitions are triggered by any event not already handled by the current state. Wildcard transitions are represented by a \*.

Wildcard transitions are useful for logging untracked events and reducing code duplication.

<!-- What you might use a wildcard transition for -->

<!-- #### Partial wildcard transitions -->

<!-- Will be in v5 -->

<!-- ### Raised events -->

<!-- Will be in v5 -->

## Actors, actions and invocations

Statecharts are executable code. When you run a statechart, it becomes an actor; a running process that can receive messages, send messages and change its behavior based on the messages it receives, causing effects outside the machine.

While the statechart actor is running, it can run other processes called actions.

An action can be fired upon entry or exit of a state and can also be fired on transitions. Entry and exit actions are fire-and-forget processes; once the machine has fired the action, it moves on and forgets the action.

<!-- What you might use an action (on a state) for -->

<!-- What you might use an action transition for -->

An invocation is an action that can run continuously and return information back to the machine. A state can invoke these actions, including communicating with other actors.
