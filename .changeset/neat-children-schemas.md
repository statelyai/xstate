---
'xstate': major
---

Add `schemas.children` for explicitly typing child actor refs by child ID. Declared child refs type `children.someId`, child snapshots, and invoke configs so `invoke: { id: 'someId', src }` must match the declared child actor contract.
