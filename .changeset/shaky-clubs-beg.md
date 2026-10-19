---
'xstate': patch
---

Fix several v6 alpha transition, typing, and inspection issues:

- Preserve enqueued effects when transition functions wrap `enq` calls in `try/catch`, and avoid reevaluating ordinary effect-only transitions during selection.
- Preserve declared schema context types in callbacks and snapshots, and reject patches containing only undeclared keys.
- Infer invoke input mapper arguments when the registered actor accepts `unknown` or `any` input.
- Report the sender of the event being processed in transition inspection events, even when more events are queued during processing.
- Report inspection observer exceptions without interrupting actor processing or other inspection observers.
- Include the source state, event, and original `cause` when graph transition evaluation fails. Supply representative payloads through the graph traversal `events` option when transition functions require them.
