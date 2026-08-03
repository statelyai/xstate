---
title: TypeScript
description: Derive types from an XState Store.
---

Store context, events, emitted events and triggers are inferred from the configuration.

```ts
import type { SnapshotFromStore } from '@xstate/store';

type StoreSnapshot = SnapshotFromStore<typeof store>;
```

Prefer derived types over duplicate interfaces. This keeps consumers aligned with the store.

## TypeScript cheatsheet

```ts
type Snapshot = SnapshotFromStore<typeof store>;
type Context = Snapshot['context'];
```
