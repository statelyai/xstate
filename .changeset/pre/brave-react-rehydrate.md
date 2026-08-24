---
'@xstate/react': major
---

Updated `@xstate/react` for XState v6. The internal Strict-Mode rehydration mechanism (`stopRootWithRehydration`) has been removed: on a Strict-Mode (or Offscreen/Activity) remount, the actor is now recreated and restarted rather than rehydrated, consistent with v6 actors no longer auto-starting children on `start()`.

In production this changes nothing — there's no throwaway double-mount, so the actor is created once and runs normally. In development, the recreated actor starts from the same logic and `input`, so it lands on the same initial snapshot; the only observable difference is for actors that accumulated child state during Strict Mode's discarded first mount, which was itself a dev-only artifact. In exchange, the package sheds a fragile, hard-to-reason-about mechanism (root-stop-with-child-snapshot-preservation plus observer muting) that existed solely to paper over Strict Mode.
