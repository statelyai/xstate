# Persist Function

The `persist` function allows you to automatically save and restore store state to/from localStorage.

## Basic Usage

```typescript
import { createStore } from '@xstate/store';
import { persist } from '@xstate/store/persist';

const store = createStore(
  persist(
    {
      context: { count: 0 },
      on: {
        increment: (context) => ({ count: context.count + 1 }),
        decrement: (context) => ({ count: context.count - 1 })
      }
    },
    { name: 'my-state' }
  )
);

// State is automatically saved to localStorage after each transition
store.send({ type: 'increment' });
// localStorage now contains: { "status": "active", "context": { "count": 1 }, ... }

// On page reload, the store will automatically restore from localStorage
```

## Custom Serializer

You can provide a custom serializer for storing/retrieving data:

```typescript
const customSerializer = {
  serialize: (value: any) => btoa(JSON.stringify(value)), // Base64 encode
  deserialize: (value: string) => JSON.parse(atob(value)) // Base64 decode
};

const store = createStore(
  persist(
    {
      context: { secret: 'initial' },
      on: {
        updateSecret: (_context, event: { secret: string }) => ({
          secret: event.secret
        })
      }
    },
    {
      name: 'encrypted-state',
      serializer: customSerializer
    }
  )
);
```

## Features

- **Automatic persistence**: State is saved to localStorage after every transition
- **Automatic restoration**: State is loaded from localStorage on store initialization
- **Error handling**: Gracefully handles localStorage errors (quota exceeded, etc.)
- **Custom serialization**: Support for custom serializers (encryption, compression, etc.)
- **Type safety**: Full TypeScript support with proper type inference

## API

### `persist(storeConfig, options)`

#### Parameters

- `storeConfig`: A store configuration object or existing store logic
- `options`: Persistence options
  - `name`: The localStorage key to use for persisting the store
  - `serializer` (optional): Custom serializer object
    - `serialize`: Function to serialize state to string
    - `deserialize`: Function to deserialize string back to state

#### Returns

A store logic object that can be passed to `createStore()`.

## Notes

- The function checks for localStorage availability and gracefully handles cases where it's not available
- If localStorage is not available or fails, the store will work normally without persistence
- Errors during save/load operations are logged as warnings but don't throw exceptions
- The persisted state includes the full store snapshot (status, context, output, error)
