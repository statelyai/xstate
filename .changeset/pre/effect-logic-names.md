---
'@xstate/effect': major
---

Effect logic creators follow the core `create*Logic` naming:

| Before                  | After                          |
| ----------------------- | ------------------------------ |
| `fromEffect`            | `createEffectLogic`            |
| `fromEffectStream`      | `createEffectStreamLogic`      |
| `fromEffectEventStream` | `createEffectEventStreamLogic` |

`EffectActor#toJSON()` returns `{ $actor: address }`, like core actors.
