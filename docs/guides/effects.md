# Effects

In statecharts, "side-effects" can be grouped into two categories:

**"Fire-and-forget" effects**, which execute a side-effect and do _not_ send any events back to the statechart:

- [Actions](./actions.md) - single, discrete effects
- [Activities](./activities.md) - continuous effects that are disposed when the state they were started in are exited

**Invoked effects**, which executes a side-effect that can send and receive events:

- [Invoked Promises](./communication.md#invoking-promises) - single, discrete effects over time that may `resolve` or `reject` once, which are sent as events to the parent machine
- [Invoked Callbacks](./communication.md#invoking-callbacks) - continuous effects over time that may send multiple events, as well as listen for events sent directly to it, to/from the parent machine
- [Invoked Machines](./communication.md) - continuous effects represented by `Machine` instances that can send/receive events, but also notify the parent machine when it has reached its [final state](./final.md)
