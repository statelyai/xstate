---
'@xstate/react': major
---

`useActorRef` is introduced, which returns an `ActorRef` from actor logic:

```ts
const actorRef = useActorRef(machine, { ... });
const anotherActorRef = useActorRef(fromPromise(...));
```

~~`useMachine`~~ is deprecated in favor of `useActor`, which works with machines and any other kind of logic

```diff
-const [state, send] = useMachine(machine);
+const [state, send] = useActor(machine);
const [state, send] = useActor(fromTransition(...));
```

~~`useSpawn`~~ is removed in favor of `useActorRef`

````diff
-const actorRef = useSpawn(machine);
+const actorRef = useActorRef(machine);

The previous use of `useActor(actorRef)` is now replaced with just using the `actorRef` directly, and with `useSelector`:

```diff
-const [state, send] = useActor(actorRef);
+const state = useSelector(actorRef, s => s);
// actorRef.send(...)
````
