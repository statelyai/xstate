---
'@xstate/solid': minor
---

author: @Andarist
pr: #3727
commit: 5fb3c68

`exports` field has been added to the `package.json` manifest. It limits what files can be imported from a package - it's no longer possible to import from files that are not considered to be a part of the public API.
