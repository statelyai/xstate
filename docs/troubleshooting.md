---
title: Troubleshooting
description: Fix common problems when building with XState.
---

## An event does nothing

Check the current snapshot and transitions defined for that state. Events without matching transitions are ignored.

## Context did not update

Return the next context from the transition function. Do not mutate `context` and return nothing.

## An async request keeps running

Pass the `signal` from `createAsyncLogic(...)` to the async API.

## A restored actor starts from the beginning

Pass the persisted snapshot as the `snapshot` option before calling `start()`.

## A nested state comparison fails

Use `snapshot.matches(...)` instead of comparing `snapshot.value` to a string.

## TypeScript accepts the wrong event

Define event schemas and send event objects. The `actor.trigger` helpers are generated from those schemas.
