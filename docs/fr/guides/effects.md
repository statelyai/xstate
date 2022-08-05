# Effects

In statecharts, "side-effects" can be grouped into two categories:

**"Fire-and-forget" effects**, which execute a synchronous side-effect with no events sent back to the statechart, or _send an event synchronously_ back to the statechart:

- [Actions](./actions.md) - single, discrete effects
- [Activities](./activities.md) - continuous effects that are disposed when the state they were started in is exited

**Invoked effects**, which execute a side-effect that can send and receive events _asynchronously_:

- [Invoked Promises](./communication.md#invoking-promises) - single, discrete effects over time that may `resolve` or `reject` once, which are sent as events to the parent machine
- [Invoked Callbacks](./communication.md#invoking-callbacks) - continuous effects over time that may send multiple events, as well as listen for events sent directly to it, to/from the parent machine
- [Invoked Observables](./communication.md#invoking-observables) - continuous effects over time that may send multiple events triggered by messages from the observed stream
- [Invoked Machines](./communication.md#invoking-machines) - continuous effects represented by `Machine` instances that can send/receive events, but also notify the parent machine when it has reached its [final state](./final.md)
