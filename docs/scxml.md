---
title: SCXML
---

# SCXML

Use `createMachineFromSCXML(...)` to create an XState machine from an [SCXML](https://www.w3.org/TR/scxml/) document.

Install the `@xstate/scxml` package alongside `xstate`. The XML parser is kept out of the `xstate` package.

```bash
npm i xstate @xstate/scxml
```

```ts
import { createActor } from 'xstate';
import { createMachineFromSCXML } from '@xstate/scxml';

const machine = createMachineFromSCXML(`
  <scxml xmlns="http://www.w3.org/2005/07/scxml"
    version="1.0"
    initial="idle">
    <state id="idle">
      <transition event="START" target="running" />
    </state>
    <state id="running" />
  </scxml>
`);

const actor = createActor(machine).start();
actor.send({ type: 'START' });
```

The returned value is an XState machine and can be passed to `createActor(...)`, `initialTransition(...)`, and other machine utilities.

> Only create machines from trusted SCXML. ECMAScript expressions and `<script>` elements execute JavaScript in the current environment.

## Compatibility with native XState

`@xstate/scxml` is experimental. `createMachineFromSCXML(...)` preserves SCXML transition rules that differ from native XState v6 machines.

| Behavior | Native `createMachine(...)` | `createMachineFromSCXML(...)` |
| --- | --- | --- |
| Parallel transition domain | Targets can update individual regions. By default, a cross-region transition preserves the source region and exits only the target region's descendants. | Uses SCXML transition domains. A cross-region transition can exit and reenter the entire parallel subtree, resetting untargeted regions to their initial states. |
| Reentry | Defaults to `reenter: false`. A transition to the source or its descendants generally preserves the source. | Targeted transitions default to `type="external"`. `type="internal"` preserves a compound source when all targets are its descendants. |
| Event descriptors | `"foo"` matches exactly. `"foo.*"` matches names such as `"foo.bar"`. | `event="foo"` matches both `foo` and `foo.bar`. |
| Competing handlers in one state | Exact handlers precede wildcards. More specific wildcard descriptors precede shorter ones. | The first enabled matching transition in document order wins, including prefix and wildcard matches. |
| Initial state | Compound states require an explicit `initial`. | Without `initial` or an `<initial>` element, a compound state enters its first child state in document order. |
| Execution errors | The nearest active `onError` can recover a failure. An unhandled failure errors the actor and stops its children. | Executable-content failures queue `error.execution` and stop the remaining content in that block. A failing `cond` evaluates to false and queues `error.execution`. |
| Undeliverable sends | Missing or stopped targets produce dead letters through `onRejectedEvent`. The sender stays active. | Invalid send targets or unsupported processor types raise `error.execution`. An unreachable SCXML session address raises `error.communication`. |

Both use XState's macrostep bound, which defaults to 1,000 microsteps. Exceeding the bound throws `InfiniteTransitionError`. SCXML itself does not prescribe this bound.

Imported machines finish all state exits before running selected transition content in document order, then enter states. Transition content sees context changes from exit handlers. The `In(...)` condition during transition content reflects the active states after exits and before entry. Initial and history-default transition content runs during entry, after the parent state's entry content.

ECMAScript `<script>` elements can mutate declared arrays and plain objects. Those mutations preserve earlier XState snapshots, including shared references and cycles within the data model.

Both process enabled eventless transitions before queued internal events and finish the macrostep before the next external event. Leaving a state stops its invoked actors. Restoring history recreates those actors rather than resuming the stopped instances.

The [parallel states guide](parallel-states.md) describes native region preservation. The [lifecycle and errors guide](lifecycle-and-errors.md) describes native error recovery and dead letters.

## Supported execution profile

The importer evaluates ECMAScript expressions and `<script>` elements as JavaScript. It also handles null data model documents, including the `In(...)` condition. It does not provide an XPath data model engine.

The supported event processor is the SCXML Event I/O Processor, with nested SCXML invocations. The optional [Basic HTTP Event I/O Processor](https://www.w3.org/TR/scxml/#BasicHTTPEventProcessor) is not implemented. External data, scripts, and invoked documents require the synchronous resolver described below.

The test suite exercises SCION and W3C fixtures from `@scion-scxml/test-framework`, plus local fixture overrides. Passing that corpus is regression coverage, not a claim of full SCXML conformance. The package does not validate every SCXML document constraint.

## External resources

SCXML can reference external data, scripts, and invoked documents. Provide a synchronous `resolveResource` function to load those resources:

```ts
const machine = createMachineFromSCXML(source, {
  resolveResource: (src, kind) => {
    // kind is "data", "script", or "invoke".
    return resources[src];
  }
});
```

If an SCXML document references an external resource and no resolver is provided, machine creation throws an error identifying the resource kind and source.

## Machine JSON

`MachineJSON` cannot represent all SCXML executable content and transition rules. Use `machineFromJSON(...)` for serialized XState definitions and `createMachineFromSCXML(...)` for SCXML documents.

## Actor isolation and condition errors

Actors created from the same SCXML machine run independently. A failing `cond` raises `error.execution` while processing the event, even when the condition prevents state entry. Checking `snapshot.can(event)` does not queue an error for a later real event.
