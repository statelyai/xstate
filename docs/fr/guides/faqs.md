# Frequently Asked Questions

Feel free to ask questions either on Stack Overflow or in the [GitHub issues](https://github.com/statelyai/xstate/issues). Questions from there will be added here over time.

<details>
  <summary>What is a finite-state machine?</summary>
  <br />
  A finite state machine (FSM) is a mathematical description of the relationships between a finite number of states, and a finite number of events that can cause transitions between states. See [the Wikipedia entry](https://en.wikipedia.org/wiki/Finite-state_machine) for more information.
</details>

<details>
  <summary>What is a statechart?</summary>
  <br />
  A statechart is an extension to finite state machines, created by David Harel. They are more flexible than finite state machines because they support:
  <ul>
    <li>hierarchical (nested) states,</li>
    <li>orthogonal (parallel) regions,</li>
    <li>state actions (entry, exit, and transition actions)</li>
    <li>history (shallow and deep) states.</li>
  </ul>
  This has the benefit of preventing [state and transition explosion](https://en.wikipedia.org/wiki/UML_state_machine#UML_extensions_to_the_traditional_FSM_formalism), which is a limitation of traditional finite state machines.
  <br />
  See [the Wikipedia entry](https://en.wikipedia.org/wiki/State_diagram#Harel_statechart) and David Harel's original paper, [Statecharts: a Visual Formalism for Complex Systems](https://www.sciencedirect.com/science/article/pii/0167642387900359/pdf) for more information.
</details>
