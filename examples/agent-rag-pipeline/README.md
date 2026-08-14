# agent-rag-pipeline

## What it teaches

How to model a retrieval-augmented generation pipeline as states — retrieve, rerank, generate — where an empty retrieval is a modelled fallback path rather than an error, and the answer carries its citations.

## XState features used

- `invoke` with `createAsyncLogic` for each pipeline stage
- branching `onDone` transition functions (empty retrieval skips reranking)
- context accumulation across stages
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Two scripted questions run through the pipeline: one that matches the in-memory document set and one that does not. The mock vector search and the mock LLM are plain functions, so the example is fully offline.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints each stage and the final answer with its sources to stdout.
