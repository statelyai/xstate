---
'xstate': patch
---

The error for a state key with an unescaped `.` now uses plain punctuation: `State key "foo.bar" contains ".". Nest the states or escape it as "foo\\.bar".`
