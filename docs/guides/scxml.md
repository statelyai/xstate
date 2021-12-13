# SCXML

XState is compatible with the [SCXML (State Chart XML: State Machine Notation for Control Abstraction) specification](https://www.w3.org/TR/scxml/). This page contains details on where our API relates to the SCXML specification.

## Events

Events in SCXML contain information relevant to the source of the event, and have a different schema than event objects in XState. Internally, event objects are converted to SCXML events for compatibility.

SCXML events include:

- `name` - a character string giving the name of the event. `name` is equivalent to the `.type` property of an XState event.
- `type` - the event type: `'platform'`, `'external'`, or `'internal'`.
  - `platform` events are raised by the platform itself, such as error events.
  - `internal` events are raised by `raise(...)` actions or by `send(...)` actions with `target: '_internal'`.
  - `external` events describe all other events.
- `sendid` - the send ID of the triggering `send(...)` action.
- `origin` - a string that allows the receiver of this event to `send(...)` a response event back to the origin.
- `origintype` - used with `origin`
- `invokeid` - the invoke ID of the invocation that triggered the child service.
- `data` - any data that the sending entity chose to include with this event. `data` is equivalent to an XState event object.

The SCXML event form of all XState events is present in the `_event` property of action and guard meta objects, as the third argument:

```js {4-5,9-10}
// ...
{
  actions: {
    someAction: (context, event, { _event }) => {
      console.log(_event); // SCXML event
    };
  },
  guards: {
    someGuard: (context, event, { _event }) => {
      console.log(_event); // SCXML event
    }
  }
}
// ..
```

## Transitions

The event-target mappings defined on the `on: { ... }` property of state nodes is synonymous to the SCXML `<transition>` element:

```js
{
  green: {
    on: {
      TIMER: {
        target: '#yellow',
        cond: context => context.timeElapsed > 5000
      },
      POWER_OUTAGE: { target: '#red.flashing' }
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

## Guards

The `cond` property is equivalent to the `cond` attribute on the SCXML `<transition>` element:

```js
{
  on: {
    e: {
      target: 'foo',
      cond: context => context.x === 1
    }
  }
}
```

```xml
<transition event="e" cond="x == 1" target="foo" />
```

Similarly, the `in` property is equivalent to the `In()` predicate:

```js
{
  on: {
    e: {
      target: 'cooking',
      in: '#closed'
    }
  }
}
```

```xml
<transition cond="In('closed')" target="cooking"/>
```

- [SCXML definition of the `cond` attribute](https://www.w3.org/TR/scxml/#transition)
- [SCXML conditional expressions and the requirement of supporting the `In()` predicate](https://www.w3.org/TR/scxml/#ConditionalExpressions)
- [How transitions are selected given an event in SCXML](https://www.w3.org/TR/scxml/#SelectingTransitions)

## State IDs

IDs correspond to the definition of IDs in the SCXML spec:

```js
{
  green: {
    id: 'lightGreen';
  }
}
```

```xml
<state id="lightGreen">
  <!-- ... -->
</state>
```

- [SCXML specification that all `id` attributes _must_ be unique](https://www.w3.org/TR/scxml/#IDs)
- [SCXML definition of the `id` attribute in `<state>`](https://www.w3.org/TR/scxml/#state)

## Actions

Executable actions in transitions are equivalent to the SCXML `<script>` element. The `entry` and `exit` properties are equivalent to the `<onentry>` and `<onexit>` elements, respectively.

```js
{
  start: {
    entry: 'showStartScreen',
    exit: 'logScreenChange',
    on: {
      STOP: {
        target: 'stop',
        actions: ['logStop', 'stopEverything']
      }
    }
  }
}
```

```xml
<state id="start">
  <onentry>
    <script>showStartScreen();</script>
  </onentry>
  <onexit>
    <script>logScreenChange();</script>
  </onexit>
  <transition event="STOP" target="stop">
    <script>logStop();</script>
    <script>stopEverything();</script>
  </transition>
</state>
```

- [SCXML definition of the `<script>` element](https://www.w3.org/TR/scxml/#script)
- [SCXML definition of the `<onentry>` element](https://www.w3.org/TR/scxml/#onentry)
- [SCXML definition of the `<onexit>` element](https://www.w3.org/TR/scxml/#onexit)

## Invoke

The `invoke` property is synonymous to the SCXML `<invoke>` element:

```js
// XState
{
  loading: {
    invoke: {
      src: 'someSource',
      id: 'someID',
      autoForward: true, // currently for machines only!
      onDone: 'success',
      onError: 'failure'
    }
  }
}
```

```xml
<!-- SCXML -->
<state id="loading">
  <invoke id="someID" src="someSource" autoforward />
  <transition event="done.invoke.someID" target="success" />
  <transition event="error.platform" cond="_event.src === 'someID'" target="failure" />
</state>
```

- [SCXML definition of `<invoke>`](https://www.w3.org/TR/scxml/#invoke)
