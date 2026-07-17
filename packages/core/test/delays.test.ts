import { createActor, setup } from '../src/index.ts';

describe('delays runtime behavior', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should warn in development when referencing an unknown delay in after transition', () => {
    const machine = setup({
      delays: {
        knownDelay: 100
      }
    }).createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            unknownDelay: 'b' as any // TypeScript can't catch this due to TS#55709
          }
        },
        b: {}
      }
    });

    const actor = createActor(machine);
    actor.start();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Delay "unknownDelay" is not configured')
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Available delays: knownDelay')
    );
  });

  it('should warn when no delays are configured and a string delay is referenced', () => {
    const machine = setup({}).createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            someDelay: 'b' as any // TypeScript can't catch this due to TS#55709
          }
        },
        b: {}
      }
    });

    const actor = createActor(machine);
    actor.start();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Delay "someDelay" is not configured')
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Available delays: none')
    );
  });

  it('should not warn when using a numeric delay', () => {
    const machine = setup({}).createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            100: 'b'
          }
        },
        b: {}
      }
    });

    const actor = createActor(machine);
    actor.start();

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should not warn when using a configured delay', () => {
    const machine = setup({
      delays: {
        myDelay: 100
      }
    }).createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            myDelay: 'b'
          }
        },
        b: {}
      }
    });

    const actor = createActor(machine);
    actor.start();

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should transition immediately when unknown delay is used (current behavior)', () => {
    return new Promise<void>((resolve, reject) => {
      const machine = setup({
        delays: {
          knownDelay: 100
        }
      }).createMachine({
        initial: 'a',
        states: {
          a: {
            after: {
              unknownDelay: 'b' as any // TypeScript can't catch this due to TS#55709
            }
          },
          b: {
            type: 'final'
          }
        }
      });

      const actor = createActor(machine);
      
      actor.subscribe({
        complete: () => {
          // Should complete immediately since unknownDelay is undefined
          resolve();
        }
      });

      actor.start();

      // If the test doesn't complete quickly, it means the transition didn't happen immediately
      setTimeout(() => {
        reject(new Error('Should have transitioned immediately'));
      }, 50);
    });
  });
});
