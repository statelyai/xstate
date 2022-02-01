import { createMachine, StateFrom, StateMachine } from '.';
import { F, List } from 'ts-toolbelt';
import { assign } from './actions';

export const toAsyncFunction = <
  TOutput,
  TStateMachine extends StateMachine<any, any, any, any, any, any, any>
>(
  machine: TStateMachine,
  toOutput: (state: StateFrom<TStateMachine>) => TOutput
) => (
  input: TStateMachine extends StateMachine<
    infer TContext,
    infer _,
    infer __,
    infer ___,
    infer ____,
    infer _____,
    infer ______
  >
    ? TContext
    : never
): Promise<TOutput> => {};

const createUser = toAsyncFunction(
  /** @xstate-layout N4IgpgJg5mDOIC5QGEBOYCGAXMACArrGKgHRqZYCWAdlAUagMQQD21YJNAbiwNYflseQsUSgADi1iUqbMSAAeiAMwAmZSQAMmgByaA7PuUBWAIxmAnMoA0IAJ6IAtOpIX9qgGwft35QBZlEwBfINtBHHpiMnRsGjoRJmJUFlJxABtsADMUgFtoimEGeUlpWWp5JQRPUxJ9YwNVTWUPfQ8ddVsHKuMLElV3Hs0LfotTZQsQ0JBqFgg4eXDCqPC4yNRiqRlKOSRFRD9VTsRTAxI9HXMdHX0A42MvELCYiISSAFUGXABjZ8gN0u25V2lWMnhIxgOHlM+l0flamkO9mOpg8JFMfgC0K8egsFz8jxAizW-y2O1AlVMOiOCEcuJIHnUbVUFj8Ojhyh0ykmQSAA */
  createMachine({
    tsTypes: {} as import('./toFunction.typegen').Typegen0,
    schema: {
      context: {} as { name: string; age: number; id?: string },
      services: {} as {
        'Create user': {
          data: string;
        };
      }
    },
    id: 'Create user',
    initial: 'Creating user',
    states: {
      'Creating user': {
        invoke: {
          id: 'Create user',
          src: 'Create user',
          onDone: [
            {
              actions: 'Assign id to context',
              target: '#Create user.User created'
            }
          ],
          onError: [
            {
              actions: 'Throw error',
              target: '#Create user.Creating user'
            }
          ]
        }
      },
      'User created': {
        type: 'final'
      }
    }
  }).withConfig({
    actions: {
      'Assign id to context': assign((_, event) => {
        return {
          id: event.data
        };
      }),
      'Throw error': () => {
        throw new Error('Could not create user');
      }
    },
    services: {
      'Create user': async () => {
        return '123';
      }
    }
  }),
  (state) => {
    return {
      id: state.context.id
    };
  }
);

interface Action<TName extends string, TInput = {}> {
  __type: 'action';
  name: TName;
  __input: TInput;
}

interface Task<TName extends string, TInput = {}, TOutput = {}> {
  __type: 'task';
  name: TName;
  __input: TInput;
  __output: TOutput;
}

interface Result<TName extends string, TInput = {}> {
  __type: 'result';
  name: TName;
  __input: TInput;
}

interface Builder {
  action: <TName extends string, TInput>(
    name: TName,
    func: (input: TInput) => void
  ) => Action<TName, TInput>;
  task: <TName extends string, TInput, TOutput>(
    name: TName,
    func: (input: TInput) => Promise<TOutput>
  ) => Task<TName, TInput, TOutput>;
}

function createTask<TX>(builder: (x: Builder) => F.Narrow<TX>) {}

createTask((x) => [x.action('foo', (input: { a: string }) => {})]);

createTask((x) => [
  x.action(
    'Report could not email user',
    async (
      // Inputs can be more than one argument
      input: { id: string }
    ) => {
      // Report could not email user
    }
  ),
  x
    .task('Email user', async (input: { id: string }) => {
      // Email user

      return input;
    })
    .onDone('User created')
    // If you error, the next state will be 'called' with
    // the inputs from the previous state
    .onError('User created', {
      actions: 'Report could not email user'
    })
  // x
  //   .initialTask('Create user', (input: { age: number; name: string }) => {
  //     return { id: '123', input };
  //   })
  //   .onDone('Email user')
  //   .onError('Errored'),
  // x.finalState('User created'),
  // x.finalState('Errored')
]);

interface ElementsBuilder {
  action: <TName extends string, TInput = {}>(
    name: TName,
    func?: (input: TInput) => void
  ) => Action<TName, TInput>;
  task: <TName extends string, TInput = {}, TOutput = {}>(
    name: TName,
    func?: (input: TInput) => Promise<TOutput>
  ) => Task<TName, TInput, TOutput>;
  result: <TName extends string, TInput = {}>(
    name: TName
  ) => Result<TName, TInput>;
}

export type Prop<T, K> = K extends keyof T ? T[K] : never;

interface ConfigBuilder<
  TElements extends any[],
  _AsObject = List.ObjectOf<TElements>
> {
  task: <
    TTaskName extends TaskName<TElements>,
    _TTask = Extract<_AsObject, { __type: 'task'; name: TTaskName }>
  >(
    name: TTaskName
  ) => _TTask;

  // _TTask extends Task<infer TName, infer TInput, infer TOutput>
  //   ? ConfigTask<TName, TInput, TOutput>
  //   : never;
}

interface ConfigTask<TName extends string, TInput, TOutput> {
  name: TName;
  __input: TInput;
  __output: TOutput;
}

type TaskName<TElements extends any[], _AsObject = List.ObjectOf<TElements>> = {
  [K in keyof _AsObject]: _AsObject[K] extends { __type: 'task'; name: any }
    ? _AsObject[K]['name']
    : never;
}[keyof _AsObject];

type ResultName<
  TElements extends any[],
  _AsObject = List.ObjectOf<TElements>
> = {
  [K in keyof _AsObject]: _AsObject[K] extends { __type: 'result'; name: any }
    ? _AsObject[K]['name']
    : never;
}[keyof _AsObject];

function createTask2<TElements extends any[], TConfig>(
  builder: (x: ElementsBuilder) => F.Narrow<TElements>,
  configBuilder: (x: ConfigBuilder<F.NoInfer<TElements>>) => F.Narrow<TConfig>
) {}

createTask2(
  (x) => [
    x.action('Report could not email user'),
    x.task('Email user'),
    x.task('Create user'),
    x.result('Could not create user'),
    x.result('User created')
  ],
  (x) => [
    x.task('Create user').onDone('Email user').onError('Could not create user'),
    x
      .task('Email user')
      .onDone('User created')
      .onError('User created', {
        actions: ['Report could not email user']
      })
  ]
);
