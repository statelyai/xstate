# Concepts

XState is a library for working with finite state machines and statecharts. It's designed to work anywhere that runs JavaScript. Using XState, you can:

1. **Create state machines and statecharts** based on the SCXML spec.
2. **Execute** statecharts in your code to express application flows or processes.
3. Use the **[actor model](./guides/actors.html)** to communicate between your statecharts.

Learn the basics of state machines and statecharts in our [no-code introduction to statecharts](../guides/introduction-to-state-machines-and-statecharts/index.md).

## Finite State Machines

A finite state machine is a mathematical model of computation that describes the behavior of a system that can be in only one state at any given time. For example, a person can be represented by a state machine with a finite number (2) of states: `asleep` or `awake`. At any given time, the person is either `asleep` or `awake`. It is impossible for the person to be both `asleep` and `awake` at the same time, and impossible for the person to be neither `asleep` nor `awake`.

Formally, finite state machines have five parts:

- A finite number of **states**
- A finite number of **events**
- An **initial state**
- A **transition function** that determines the next state given the current state and event
- A (possibly empty) set of **final states**

**State** refers to some finite, _qualitative_ “mode” or “status” of a system being modeled by a state machine, and does not describe all the (possibly infinite) data related to that system. For example, water can be in 1 of 4 states: `ice`, `liquid`, `gas`, or `plasma`. However, the temperature of water can vary and its measurement is _quantitative_ and infinite.

### Further resources on state machines

- [Finite-state machine article on Wikipedia](https://en.wikipedia.org/wiki/Finite-state_machine)
- [Understanding State Machines by Mark Shead](https://www.freecodecamp.org/news/state-machines-basics-of-computer-science-d42855debc66/)
- [▶️ A-Level Comp Sci: Finite State Machine](https://www.youtube.com/watch?v=4rNYAvsSkwk)

## Statecharts

Statecharts are a formalism for modeling stateful, reactive systems. Computer scientist David Harel presented this formalism as an extension to state machines in his 1987 paper [Statecharts: A Visual Formalism for Complex Systems](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf). Some of the extensions include:

- Guarded transitions
- Actions (entry, exit, transition)
- Extended state (context)
- Orthogonal (parallel) states
- Hierarchical (nested) states
- History

### Further resources on statecharts

- [Statecharts: A Visual Formalism for Complex Systems by David Harel](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf)
- [The World of Statecharts by Erik Mogensen](https://statecharts.github.io/)

## Actor model

The actor model is another old mathematical model of computation that complements state machines. It states that everything is an “actor” that can do three things:

- **Receive** messages
- **Send** messages to other actors
- Do something with the messages it received (its **behavior**), such as:
  - change its local state
  - send messages to other actors
  - _spawn_ new actors

An actor's behavior can be described by a state machine (or a statechart).

### Further resources on the actor model

- [Actor model article on Wikipedia](https://en.wikipedia.org/wiki/Actor_model)
- [The actor model in 10 minutes by Brian Storti](https://www.brianstorti.com/the-actor-model/)
