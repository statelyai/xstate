# Glossary

Adapted from [The World of Statecharts (Glossary)](https://statecharts.dev/glossary/).

## Action

An action is an [effect](../guides/effects.md) that is executed as a reaction to a state transition. Actions are fire-and-forget; that is, they are executed without needing to wait for a response.

## Actor

An actor is an entity that can send messages to other actors, receive messages, and designate its next behavior in response to a message, which may include spawning other actors.

## Atomic state

An atomic state is a state node that has no child states.

## Compound state

A compound state has one or more child states. One of these child states must be the initial state, which is the default state node entered when the parent compound state is entered.

## Condition

See [guard](#guard).

## Entry action

An entry action is an [action](#action) that is executed when its parent state is entered.

## Event

An event is an indication that something happened at a specific moment in time. Events are what state machines receive, and are what cause transitions to potentially be taken.

## Eventless transition

An eventless transition is a transition that is automatically taken when its parent state is active.

## Exit action

An exit action is an [action](#action) that is executed when its parent state is exited.

## External transition

In SCXML, an external transition is a transition that exits the source state when the target state is a descendant of the source state. See [selecting transitions (SCXML)](https://www.w3.org/TR/scxml/#SelectingTransitions) for details.

## Final state

A final state is an indication that the state is "done", and no more events will be handled from it.

## Guard

A guard is a Boolean expression that determines whether a transition is enabled (if the condition evaluates to _true_) or disabled (_false_). Also known as a [condition](#condition).

## History state

A history state is a pseudo-state that will remember and transition to the most recently active child states of its parent state, or a default target state.

## Initial state

The initial state of a compound state is the default child state that is entered when the compound state is entered.

## Internal event

An internal event is an event that is raised by the state machine itself. Internal events are processed immediately after the previous event.

## Internal transition

In SCXML, an internal transition is a transition that transitions to a descendant target state without exiting the source state. This is the default transition behavior. See [selecting transitions (SCXML)](https://www.w3.org/TR/scxml/#SelectingTransitions) for details.

## Mathematical model of computation

A mathematical model of computation is a way of describing how things are computed (given an input, what is the output?) based on a mathematical function. With state machines and statecharts, the pertinent function is the _state-transition function_ (see [Finite state machine: Mathematical model (Wikipedia)](https://en.wikipedia.org/wiki/Finite-state_machine#Mathematical_model))

See [Model of computation (Wikipedia)](https://en.wikipedia.org/wiki/Model_of_computation) and [Mathematical model (Wikipedia)](https://en.wikipedia.org/wiki/Mathematical_model) for more information.

## Orthogonal state

See [parallel state](#parallel-state).

## Parallel state

A parallel state is a compound state where all of its child states (known as _regions_) are active simultaneously.

## Pseudostate

A transient state; e.g., an [initial state](#initial-state) or a [history state](#history-state).

## Raised event

See [internal event](#internal-event).

## Service

A service is an interpreted [machine](#state-machine); i.e., an [actor](#actor) that represents a machine.

## State machine

A state machine is a mathematical model of the behavior of a system. It describes the behavior through [states](#state), [events](#event), and [transitions](#transition).

## State

A state represents the overall behavior of a state machine. In statecharts, the state is the aggregate of all active states (which can be atomic, compound, parallel, and/or final).

## Transient state

A transient state is a state that only has [eventless transitions](#eventless-transition).

## Transition

A transition is a description of which target [state(s)](#state) and [actions](#action) a state machine will immediately be in when a specific [event](#event) is taken in the transition's source state.

## Visual formalism

A visual formalism is an exact language (like a programming language) that primarily uses visual symbols (states, transitions, etc.) instead of only code or text. State diagrams and statecharts are visual formalisms.

> Visual formalisms are diagrammatic and intuitive, yet mathematically rigorous languages.
>
> – https://link.springer.com/referenceworkentry/10.1007%2F978-0-387-39940-9_444
