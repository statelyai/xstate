import * as React from 'react';
import { createMachine, TypegenMeta } from 'xstate';
import { render } from '@testing-library/react';
import { useMachine, useInterpret } from '../src';

describe('useMachine', () => {
  it('should allow to be used with a machine without any missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        services: never;
      };
    }

    const machine = createMachine({
      types: {} as TypesMeta
    });

    function App() {
      useMachine(machine);
      return null;
    }

    render(<App />);
  });

  it('should not allow to be used with a machine with some missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        services: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useMachine(machine);
      return null;
    }

    render(<App />);
  });

  it('should require all missing implementations ', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: 'myDelay';
        guards: never;
        services: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
        myDelay: 'BAR';
      };
    }

    const machine = createMachine({
      types: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useMachine(machine, {});
      useMachine(machine, {
        // @ts-expect-error
        actions: {}
      });
      // @ts-expect-error
      useMachine(machine, {
        actions: {
          myAction: () => {}
        }
      });
      useMachine(machine, {
        actions: {
          myAction: () => {}
        },
        delays: {
          myDelay: () => 42
        }
      });
      return null;
    }

    render(<App />);
  });

  it('should allow to override already provided implementation', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'fooAction';
        delays: never;
        guards: never;
        services: never;
      };
      eventsCausingActions: { fooAction: 'FOO' };
      eventsCausingDelays: { barDelay: 'BAR' };
    }

    const machine = createMachine(
      {
        types: {} as TypesMeta,
        schema: {
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        delays: {
          barDelay: () => 42
        }
      }
    );

    function App() {
      useMachine(machine, {
        actions: {
          fooAction: () => {}
        },
        delays: {
          barDelay: () => 100
        }
      });
      return null;
    }

    render(<App />);
  });
});

describe('useInterpret', () => {
  it('should allow to be used with a machine without any missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        services: never;
      };
    }

    const machine = createMachine({
      types: {} as TypesMeta
    });

    function App() {
      useInterpret(machine);
      return null;
    }

    render(<App />);
  });

  it('should not allow to be used with a machine with some missing implementations', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: never;
        guards: never;
        services: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
      };
    }

    const machine = createMachine({
      types: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useInterpret(machine);
      return null;
    }

    render(<App />);
  });

  it('should require all missing implementations ', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'myAction';
        delays: 'myDelay';
        guards: never;
        services: never;
      };
      eventsCausingActions: {
        myAction: 'FOO';
        myDelay: 'BAR';
      };
    }

    const machine = createMachine({
      types: {} as TypesMeta,
      schema: {
        events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
      }
    });

    function App() {
      // @ts-expect-error
      useInterpret(machine, {});
      useInterpret(machine, {
        // @ts-expect-error
        actions: {}
      });
      // @ts-expect-error
      useInterpret(machine, {
        actions: {
          myAction: () => {}
        }
      });
      useInterpret(machine, {
        actions: {
          myAction: () => {}
        },
        delays: {
          myDelay: () => 42
        }
      });
      return null;
    }

    render(<App />);
  });

  it('should allow to override already provided implementation', () => {
    interface TypesMeta extends TypegenMeta {
      missingImplementations: {
        actions: 'fooAction';
        delays: never;
        guards: never;
        services: never;
      };
      eventsCausingActions: { fooAction: 'FOO' };
      eventsCausingDelays: { barDelay: 'BAR' };
    }

    const machine = createMachine(
      {
        types: {} as TypesMeta,
        schema: {
          events: {} as { type: 'FOO' } | { type: 'BAR' } | { type: 'BAZ' }
        }
      },
      {
        delays: {
          barDelay: () => 42
        }
      }
    );

    function App() {
      useInterpret(machine, {
        actions: {
          fooAction: () => {}
        },
        delays: {
          barDelay: () => 100
        }
      });
      return null;
    }

    render(<App />);
  });
});
