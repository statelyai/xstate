---
'@xstate/react': patch
---

In v2 we have changed signatures of `useMachine` and `useInterpret`. Instead of accepting a list of generics they now only support a single generic: `TMachine`. This change, erroneously, was only introduced to types targeting TS@4.x but the types targeting previous TS releases were still using the older signatures. This has now been fixed and users of older TS versions should now be able to leverage typegen with `@xstate/react`.
