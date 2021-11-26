# Input <Badge text="4.25+" />

[:rocket: Quick Reference](#quick-reference)

When you're building software, it's common to split your code up into small pieces. These might be functions in a node process, or framework components. These small pieces often need to declare **dependencies** - bits of information/code that they're not responsible for, but that they rely on to serve their purpose.

The best way to declare dependencies to an XState machine is called `input`. You can specify input like so:

```ts
const machine = createMachine(
  {
    entry: (context, event, meta) => {
      console.log(meta.state.input.lyric); // 'In west Philadelphia, born and raised'
    }
  },
  {
    input: {
      lyric: 'In west Philadelphia, born and raised'
    }
  }
);
```

Or, by using the `.withConfig` method:

```ts
const machineWithDifferentInput = machine.withConfig({
  input: {
    lyric: 'In the playground, where I spend most of my days'
  }
});
```

The input is then available in any action/service/guard, in the `meta` argument.

```ts
const machine = createMachine(
  {
    entry: [
      (context, event, meta) => {
        console.log(meta.state.input.foo);
      }
    ],
    invoke: {
      src: (context, event, meta) => {
        console.log(meta.state.input.foo);
      },
      onDone: {
        cond: (context, event, meta) => {
          console.log(meta.state.input.foo);
          return false;
        }
      }
    }
  },
  {
    input: {
      foo: 'bar'
    }
  }
);
```

Unlike [context](./context.md), inputs cannot be assigned to from _inside_ the machine. If you do need to mutate the input locally, consider putting it in `context` instead.

### Inputs that change over time

You can change an input on a service that's running by calling `service.input()`.

```ts
const service = interpret(machine).start();

service.input({
  foo: 'bar'
});
```

Under the hood, this sends a `xstate.input` event which XState recognises internally and uses to update the input.

### Listening for changes

You can listen for changes by listening for the `xstate.input` event:

```ts
const machine = createMachine({
  on: {
    'xstate.input': {
      actions: (context, event, meta) => {
        console.log(meta.state.input);
      }
    }
  }
});
```

Note that `meta` will be updated _before_ the actions and guards that listen for this transition are executed. This means you don't need to read the updated input from the event:

```ts {5-6,8-9}
const machine = createMachine({
  on: {
    'xstate.input': {
      actions: (context, event, meta) => {
        // ⚠️ Avoid - prefer `meta.state.input` instead
        console.log(event.input);

        // ✅
        console.log(meta.state.input);
      }
    }
  }
});
```

## Usage

### Frontend

'Dependencies which change over time', otherwise known as **props**, is a common pattern in modern frontend frameworks. Input allows you to use props in your state machines. See the docs on each individual framework to learn more:

- [React](../recipes/react.md#syncing-data-with-input)
- Vue (Not yet complete)
- Svelte (Not yet complete)

## Examples

### Listening for data from a query

```ts
import { createModel } from 'xstate/lib/model';

interface Data {
  id: string;
}

const model = createModel({}).withInput(
  {} as {
    data?: Data;
    error?: string;
  }
);

const machine = model.createMachine(
  {
    initial: 'pending',
    always: [
      {
        // If we have an error on the input, go to the hasErrored state
        cond: 'hasErrorOnInput',
        target: 'hasErrored'
      },
      {
        // If we have data on the input, go to the hasData state
        cond: 'hasDataOnInput',
        target: 'hasData'
      }
    ],
    states: {
      pending: {},
      hasData: {},
      hasErrored: {}
    }
  },
  {
    guards: {
      hasDataOnInput: (context, event, meta) => {
        return Boolean(meta.state.input.data);
      },
      hasErrorOnInput: (context, event, meta) => {
        return Boolean(meta.state.input.error);
      }
    }
  }
);
```

## Quick Reference

#### Declare input in the options object

```ts
const machine = createMachine(
  {},
  {
    input: {
      foo: 'bar'
    }
  }
);
```

#### Redeclare input using .withConfig

```ts
const newMachine = machine.withConfig({
  input: {
    foo: 'bar'
  }
});
```

#### Update input in a running service with `.input`

```ts
const service = interpret(machine).start();

/**
 * It doesn't have to be the whole input -
 * it can be a partial
 */
service.input({
  foo: 'bar'
});
```

#### Listening for input changes

```ts
const machine = createMachine({
  on: {
    'xstate.input': {
      actions: (context, event, meta) => {
        console.log(meta.state.input);
      }
    }
  }
});
```

#### Declare the input type using `createModel`

```ts
const model = createModel({}).withInput({
  input: {} as {
    foo: string;
  }
});

const machine = createMachine(
  {},
  {
    input: {
      foo: 'bar'
    }
  }
);
```

#### Access input in guards/actions/services

```ts{5,10,14}
const machine = createMachine(
  {
    entry: [
      (context, event, meta) => {
        console.log(meta.state.input.foo);
      }
    ],
    invoke: {
      src: (context, event, meta) => {
        console.log(meta.state.input.foo);
      },
      onDone: {
        cond: (context, event, meta) => {
          console.log(meta.state.input.foo);
        }
      }
    }
  },
  {
    input: {
      foo: 'bar'
    }
  }
);
```

#### Access input in the state of the machine

```ts
const machine = createMachine(
  {},
  {
    input: {
      foo: 'bar'
    }
  }
);

console.log(machine.initialState.input.foo);
```
