---
title: Model application behavior
description: Turn requirements into states, events and transitions.
---

Start with behavior, not code.

## List the events

Write down the things that can happen: submit, succeed, fail, retry and cancel.

## Identify meaningful states

Ask what changes how the system responds to an event. A form may be `editing`, `submitting`, `succeeded` or `failed`.

Avoid using context values as hidden states. If `isLoading` changes which events are allowed, `loading` is probably a state.

## Connect states with events

```text
editing --submit--> submitting
submitting --resolved--> succeeded
submitting --rejected--> failed
failed --retry--> submitting
submitting --cancel--> editing
```

## Check the model

Look for states with no way in or out, forbidden events, async work without failure behavior, boolean combinations, and behavior that needs another actor.

Implement the smallest useful model first. Add hierarchy and actors when the model needs those boundaries.
