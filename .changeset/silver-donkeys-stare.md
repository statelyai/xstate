---
'xstate': minor
---

Add `snapshot.sessionId`. Two main motivations:

- To be able to identify the actor `sessionId` a snapshot belonged to when inspecting, even if the actor is mutated (which can report an incorrect `actorRef.sessionId` if read directly)
- Brings back a little compatibility with SCXML:

> _\_sessionid_. The SCXML Processor must bind the variable \_sessionid at load time to the system-generated id for the current SCXML session. (This is of type NMTOKEN.) The Processor must keep the variable bound to this value until the session terminates.
