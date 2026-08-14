import { createActor, setup, toPromise, types, createAsyncLogic } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) => console.log(message);

interface Doc {
  id: string;
  title: string;
  text: string;
  keywords: string[];
}

interface Hit {
  doc: Doc;
  score: number;
}

const CORPUS: Doc[] = [
  {
    id: 'doc-1',
    title: 'Statecharts: a visual formalism',
    text: 'Statecharts extend state machines with hierarchy, orthogonality and broadcast communication.',
    keywords: ['statechart', 'hierarchy', 'formalism']
  },
  {
    id: 'doc-2',
    title: 'Actors and message passing',
    text: 'An actor has its own state, can spawn other actors, and communicates only by sending messages.',
    keywords: ['actor', 'message', 'spawn']
  },
  {
    id: 'doc-3',
    title: 'Guards and transitions',
    text: 'A transition may be taken only when its condition holds, which keeps impossible states unreachable.',
    keywords: ['transition', 'condition', 'actor']
  }
];

/** Mock vector search: keyword overlap stands in for cosine similarity. */
const retrieve = createAsyncLogic({
  run: async ({ input }: { input: { question: string } }) => {
    const terms = input.question.toLowerCase().split(/\W+/).filter(Boolean);
    const hits = CORPUS.map((doc) => ({
      doc,
      score: doc.keywords.filter((keyword) => terms.includes(keyword)).length
    })).filter((hit) => hit.score > 0);
    log(`retrieved ${hits.length} candidate(s) for "${input.question}"`);
    return hits;
  }
});

/** Mock cross-encoder: rescores candidates and keeps the top two. */
const rerank = createAsyncLogic({
  run: async ({ input }: { input: { question: string; hits: Hit[] } }) => {
    const terms = input.question.toLowerCase().split(/\W+/).filter(Boolean);
    const reranked = input.hits
      .map((hit) => ({
        ...hit,
        score:
          hit.score +
          terms.filter((term) => hit.doc.text.toLowerCase().includes(term))
            .length /
            10
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    log(
      `reranked to ${reranked.map((hit) => `${hit.doc.id}(${hit.score.toFixed(1)})`).join(', ')}`
    );
    return reranked;
  }
});

/** Mock LLM: grounded when given passages, parametric when given none. */
const generate = createAsyncLogic({
  run: async ({
    input
  }: {
    input: { question: string; hits: Hit[]; grounded: boolean };
  }) => {
    if (!input.grounded) {
      return {
        answer: `From model memory alone: ${input.question} is not covered by the indexed documents.`,
        citations: [] as string[]
      };
    }
    return {
      answer: input.hits
        .map((hit) => hit.doc.text)
        .join(' ')
        .slice(0, 160),
      citations: input.hits.map((hit) => `${hit.doc.id} — ${hit.doc.title}`)
    };
  }
});

const ragMachine = setup({
  schemas: {
    context: types<{
      question: string;
      hits: Hit[];
      grounded: boolean;
      answer: string;
      citations: string[];
    }>(),
    input: types<{ question: string }>(),
    output: types<{
      answer: string;
      citations: string[];
      grounded: boolean;
    }>()
  }
}).createMachine({
  context: ({ input }) => ({
    question: input.question,
    hits: [],
    grounded: true,
    answer: '',
    citations: []
  }),
  initial: 'retrieving',
  states: {
    retrieving: {
      invoke: {
        src: retrieve,
        input: ({ context }) => ({ question: context.question }),
        // Empty retrieval is a first-class path, not an error: the pipeline
        // skips reranking and falls back to an ungrounded answer.
        onDone: ({ event }, enq) => {
          if (event.output.length === 0) {
            enq(log, 'no passages matched — falling back to the model alone');
            return { target: 'generating', context: { grounded: false } };
          }
          return { target: 'reranking', context: { hits: event.output } };
        }
      }
    },
    reranking: {
      invoke: {
        src: rerank,
        input: ({ context }) => ({
          question: context.question,
          hits: context.hits
        }),
        onDone: ({ event }) => ({
          target: 'generating',
          context: { hits: event.output }
        })
      }
    },
    generating: {
      invoke: {
        src: generate,
        input: ({ context }) => ({
          question: context.question,
          hits: context.hits,
          grounded: context.grounded
        }),
        onDone: ({ event }) => ({
          target: 'answered',
          context: {
            answer: event.output.answer,
            citations: event.output.citations
          }
        })
      }
    },
    answered: {
      type: 'final',
      output: ({ context }) => ({
        answer: context.answer,
        citations: context.citations,
        grounded: context.grounded
      })
    }
  }
});

for (const question of [
  'how does an actor spawn a transition',
  'what is the capital of France'
]) {
  const actor = createActor(ragMachine, {
    input: { question },
    inspect: inspector?.inspect
  });
  actor.start();
  const result = await toPromise(actor);

  log(`\nQ: ${question}`);
  log(`A: ${result.answer}`);
  log(
    result.grounded
      ? `sources:\n${result.citations.map((c) => `  - ${c}`).join('\n')}`
      : 'sources: none (UNGROUNDED — answered without retrieval)'
  );
  log('');
}

inspector?.destroy();
