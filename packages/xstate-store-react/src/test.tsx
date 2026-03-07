import { createStore } from '@xstate/store-react';

const SWAPI_BASE_URL = 'https://swapi.dev/api/';

export interface SwPeopleContext {
  state: SwPeopleState;
  isLoading: boolean;
}

export type SwPeopleState =
  | { status: 'idle' }
  | { status: 'loading_search'; query: string }
  | { status: 'loading_by_id'; id: number }
  | {
      status: 'success_search';
      query: string;
      people: SwapiPerson[];
      count: number;
      nextUrl: string | null;
      previousUrl: string | null;
    }
  | (SwapiPerson & {
      status: 'success_by_id';
      id: number;
    })
  | {
      status: 'error';
      message: string;
    };

type SwPeopleEventPayloadMap = {
  search: {
    query: string;
    fail?: boolean;
  };
  getById: {
    id: number;
    fail?: boolean;
  };
  searchSucceeded: {
    query: string;
    data: SwapiPeopleResponse;
  };
  byIdSucceeded: {
    id: number;
    data: SwapiPerson;
  };
  fetchFailed:
    | {
        source: 'search';
        query: string;
        message: string;
      }
    | {
        source: 'by_id';
        id: number;
        message: string;
      };
  reset: Record<string, never>;
};

interface SwapiPeopleResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SwapiPerson[];
}

export interface SwapiPerson {
  name: string;
  birth_year: string;
  eye_color: string;
  gender: string;
  hair_color: string;
  height: string;
  mass: string;
  skin_color: string;
  homeworld: string;
  films: string[];
  species: string[];
  starships: string[];
  vehicles: string[];
  url: string;
  created: string;
  edited: string;
}

const initialContext: Readonly<SwPeopleContext> = {
  state: { status: 'idle' },
  isLoading: false
};

export const swPeopleStore = createStore<
  SwPeopleContext,
  SwPeopleEventPayloadMap,
  never
>({
  context: initialContext,
  on: {
    search: (context, event, enqueue) => {
      if (context.isLoading) return context;

      const requestUrl = resolvePeopleUrl(event.query);
      console.log(`[search] requestUrl:`, requestUrl);

      enqueue.effect(async () => {
        try {
          if (event.fail) {
            swPeopleStore.trigger.fetchFailed({
              source: 'search',
              query: event.query,
              message: 'Forced search error (fail flag enabled).'
            });
            return;
          }

          const response = await fetch(requestUrl);

          if (!response.ok) {
            swPeopleStore.trigger.fetchFailed({
              source: 'search',
              query: event.query,
              message: `Request failed with status ${response.status}`
            });
            return;
          }

          const data = (await response.json()) as SwapiPeopleResponse;
          swPeopleStore.trigger.searchSucceeded({
            data,
            query: event.query
          });
        } catch (error) {
          swPeopleStore.trigger.fetchFailed({
            source: 'search',
            query: event.query,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      return {
        state: {
          status: 'loading_search',
          query: event.query
        },
        isLoading: true
      };
    },
    getById: (context, event, enqueue) => {
      if (context.isLoading) return context;

      const requestUrl = resolvePeopleByIdUrl(event.id);
      console.log(`[getById] requestUrl:`, requestUrl);

      enqueue.effect(async () => {
        try {
          if (event.fail) {
            swPeopleStore.trigger.fetchFailed({
              source: 'by_id',
              id: event.id,
              message: 'Forced getById error (fail flag enabled).'
            });
            return;
          }

          const response = await fetch(requestUrl);

          if (!response.ok) {
            swPeopleStore.trigger.fetchFailed({
              source: 'by_id',
              id: event.id,
              message: `Request failed with status ${response.status}`
            });
            return;
          }

          const person = (await response.json()) as SwapiPerson;
          swPeopleStore.trigger.byIdSucceeded({
            data: person,
            id: event.id
          });
        } catch (error) {
          swPeopleStore.trigger.fetchFailed({
            source: 'by_id',
            id: event.id,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      return {
        state: {
          status: 'loading_by_id',
          id: event.id
        },
        isLoading: true
      };
    },
    searchSucceeded: (_, event) => ({
      state: {
        status: 'success_search',
        people: event.data.results,
        count: event.data.count,
        nextUrl: event.data.next,
        previousUrl: event.data.previous,
        query: event.query
      },
      isLoading: false
    }),
    byIdSucceeded: (_, event) => {
      const person = event.data;
      return {
        state: {
          ...person,
          status: 'success_by_id',
          id: event.id
        },
        isLoading: false
      };
    },
    fetchFailed: (_, event) => {
      return {
        state: {
          status: 'error',
          message: event.message
        },
        isLoading: false
      };
    },
    reset: () => ({ ...initialContext })
  }
});

const resolvePeopleUrl = (query: string) => {
  const url = new URL('people/', SWAPI_BASE_URL);
  if (query) url.searchParams.set('search', query);
  return url.toString();
};

const resolvePeopleByIdUrl = (id: number) =>
  new URL(`people/${id}/`, SWAPI_BASE_URL).toString();

const stateSelector = swPeopleStore.select((context) => context.state);
stateSelector.subscribe((state) => {
  switch (state.status) {
    case 'success_by_id':
      console.log(`[people.changed]`, state.name);
      return;
    case 'success_search':
      console.log(`[people.changed]`, state.people.length);
      return;
    case 'error':
      console.error(`[error.changed]`, state.message);
      return;
    default:
      return;
  }
});

const isLoadingSelector = swPeopleStore.select((context) => context.isLoading);
isLoadingSelector.subscribe((isLoading) => {
  console.log(`[isLoading.changed]`, isLoading);
});

const runDemo = async () => {
  swPeopleStore.trigger.search({ query: 'figo' });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  swPeopleStore.trigger.search({ query: 'luke' });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  swPeopleStore.trigger.getById({ id: 10 });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  swPeopleStore.trigger.getById({ id: 10, fail: true });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  swPeopleStore.trigger.search({ query: 'luke', fail: true });
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

void runDemo();
