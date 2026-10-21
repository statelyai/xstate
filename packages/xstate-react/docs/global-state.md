---
title: Global state
description: Run one application-wide actor and read it from any component.
---

Some state belongs to the application rather than to a piece of the UI: the signed-in session, a notification queue, a media player that keeps playing while the user navigates. Create that actor once at module scope and read it with [`useSelector`](selectors.md).

```tsx
// player.ts
import { createActor } from 'xstate';

export const playerActor = createActor(playerMachine).start();
```

```tsx
// TransportControls.tsx
import { useSelector } from '@xstate/react';
import { playerActor } from './player';

export function TransportControls() {
  const isPlaying = useSelector(playerActor, (s) => s.matches('playing'));

  return (
    <button onClick={() => playerActor.trigger.toggle()}>
      {isPlaying ? 'Pause' : 'Play'}
    </button>
  );
}
```

There is no provider and no hook that owns the actor. Any module can import the actor and send to it, including code outside React such as a router guard or a service worker message handler.

The actor is started at import time and never stopped, so it survives every unmount. That is the intended behavior for a media player. For state scoped to a screen, it is a leak.

## Module scope or provider?

| | Module-scope actor | [`createActorContext`](shared-actors.md) |
| --- | --- | --- |
| Lifetime | The page session | The provider's mount |
| Instances | Exactly one | One per rendered provider |
| Input | Fixed at module load | Per provider, via `options.input` |
| Server rendering | Unsafe — shared between requests | Safe — one actor per render |
| Reset | Manual, via an event | Unmount and remount |

Choose a module-scope actor when there is exactly one of the thing and it should outlive any component. Choose a provider when the actor is scoped to a screen, a route, a dialog, or an item, or when it needs input that only a component knows.

> **Warning:** Never create a module-scope actor in code that runs on the server. The module is shared by every request, so one user's state leaks into another's response. See [server rendering](server-rendering.md).

## Several global actors

Independent concerns get independent actors. A session actor, a notification actor and a player actor are three module-scope actors, each with its own file and its own selectors.

```tsx
const unread = useSelector(notificationsActor, (s) => s.context.unread.length);
const userName = useSelector(sessionActor, (s) => s.context.user?.name);
```

When those actors must reach each other, put them in one [actor system](../systems.md) instead of importing one into the other. Declare the registry up front and look actors up by key from inside machine logic.

```tsx
// system.ts
import { createSystem } from 'xstate';

export const appSystem = createSystem({
  registry: { notifications: notificationsMachine }
});

export const appActor = appSystem.createActor(appMachine).start();
```

```ts
// inside appMachine
on: {
  'order.placed': ({ system }, enq) => {
    enq.sendTo(system.get('notifications'), {
      type: 'notify',
      message: 'Order placed'
    });
  }
}
```

Components still read whichever actor holds the value they render:

```tsx
const notifications = appActor.system.get('notifications');
const unread = useSelector(notifications, (s) => s?.context.unread.length ?? 0);
```

Registry entries are removed when their actor stops, so handle `undefined`.

A single root actor that [invokes](../invoke.md) or [spawns](../spawn.md) its children is usually clearer than several independent roots. Children then persist together in one `getPersistedSnapshot()` call, and one `appActor.stop()` tears everything down.

## Global state cheatsheet

```tsx
// module scope
export const appActor = createActor(appMachine, { input }).start();

// in a component
const value = useSelector(appActor, (snapshot) => snapshot.context.value);
appActor.trigger.refresh();

// systems
const system = createSystem({ registry: { notifications: notificationsMachine } });
const actor = system.createActor(appMachine).start();
system.get('notifications');
```
