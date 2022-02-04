---
'xstate': patch
---

Moved an internal `@ts-ignore` to a JSDoc-style comment to fix consuming projects that do not use `skipLibCheck`. Regular inline and block comments are not preserved in the TypeScript's emit.
