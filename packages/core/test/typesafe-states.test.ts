import { describe, it, expect } from 'vitest';
import { createMachine } from '../src/createMachine';
import { setup } from '../src/setup';
import { fromPromise } from '../src/actors/promise';

describe('type-safe state names', () => {
  describe('createMachine', () => {
    // --- on: bare string ---
    it('should allow valid bare string target in on', () => {
      createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: 'b' } },
          b: {}
        }
      });
    });

    it('should reject invalid bare string target in on', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              on: {
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                GO: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    // --- on: object-form ---
    it('should allow valid object-form target in on', () => {
      createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: { target: 'b' } } },
          b: {}
        }
      });
    });

    it('should reject invalid object-form target in on', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              on: {
                GO: {
                  // @ts-expect-error - 'nonExistent' is not a valid sibling state
                  target: 'nonExistent'
                }
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    // --- on: array of objects ---
    it('should allow valid array of object-form targets in on', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: [{ target: 'b' }, { target: 'c' }]
            }
          },
          b: {},
          c: {}
        }
      });
    });

    it('should reject invalid target in array of objects in on', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              on: {
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                GO: [
                  { target: 'b' },
                  { target: 'nonExistent' }
                ]
              }
            },
            b: {},
            c: {}
          }
        });
      }).toThrow();
    });

    // --- always ---
    it('should allow valid always target (object-form)', () => {
      createMachine({
        initial: 'a',
        states: {
          a: { always: { target: 'b' } },
          b: {}
        }
      });
    });

    it('should allow valid always target (bare string)', () => {
      createMachine({
        initial: 'a',
        states: {
          a: { always: 'b' },
          b: {}
        }
      });
    });

    it('should reject invalid always target (bare string)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              // @ts-expect-error - 'nonExistent' is not a valid sibling state
              always: 'nonExistent'
            },
            b: {}
          }
        });
      }).toThrow();
    });

    it('should reject invalid always target (object-form)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              always: {
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                target: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    it('should allow valid always target (array of objects)', () => {
      createMachine({
        initial: 'a',
        states: {
          a: { always: [{ target: 'b' }, { target: 'c' }] },
          b: {},
          c: {}
        }
      });
    });

    // --- after ---
    it('should allow valid after target (bare string)', () => {
      createMachine({
        initial: 'a',
        states: {
          a: { after: { 1000: 'b' } },
          b: {}
        }
      });
    });

    it('should allow valid after target (object-form)', () => {
      createMachine({
        initial: 'a',
        states: {
          a: { after: { 1000: { target: 'b' } } },
          b: {}
        }
      });
    });

    it('should reject invalid after target (bare string)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              after: {
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                1000: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    it('should reject invalid after target (object-form)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              after: {
                1000: {
                  // @ts-expect-error - 'nonExistent' is not a valid sibling state
                  target: 'nonExistent'
                }
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    // --- onDone on state nodes ---
    it('should allow valid onDone target (bare string)', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'child',
            states: { child: { type: 'final' } },
            onDone: 'b'
          },
          b: {}
        }
      });
    });

    it('should allow valid onDone target (object-form)', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'child',
            states: { child: { type: 'final' } },
            onDone: { target: 'b' }
          },
          b: {}
        }
      });
    });

    it('should reject invalid onDone target (bare string)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              // @ts-expect-error - 'nonExistent' is not a valid sibling state
              onDone: 'nonExistent'
            },
            b: {}
          }
        });
      }).toThrow();
    });

    it('should reject invalid onDone target (object-form)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              onDone: {
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                target: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    // --- invoke.onDone / invoke.onError ---
    it('should allow valid invoke.onDone target', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: fromPromise(() => Promise.resolve()),
              onDone: { target: 'b' }
            }
          },
          b: {}
        }
      });
    });

    it('should allow valid invoke.onError target', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: fromPromise(() => Promise.resolve()),
              onError: { target: 'b' }
            }
          },
          b: {}
        }
      });
    });

    it('should allow valid invoke.onDone bare string target', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: fromPromise(() => Promise.resolve()),
              onDone: 'b'
            }
          },
          b: {}
        }
      });
    });

    it('should allow valid invoke.onError bare string target', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: fromPromise(() => Promise.resolve()),
              onError: 'b'
            }
          },
          b: {}
        }
      });
    });

    // --- target patterns ---
    it('should allow dot-prefixed child targets', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'child',
            states: { child: {} },
            on: { GO: { target: '.child' } }
          },
          b: {}
        }
      });
    });

    it('should allow hash-prefixed id targets', () => {
      createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: { target: '#myB' } } },
          b: { id: 'myB' }
        }
      });
    });

    it('should allow dot-path sibling targets', () => {
      createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: { target: 'b.nested' } } },
          b: {
            initial: 'nested',
            states: { nested: {} }
          }
        }
      });
    });

    it('should allow escaped dot targets for state names with dots', () => {
      createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: 'foo\\.bar' } },
          'foo.bar': {}
        }
      });
    });

    // --- initial ---
    it('should allow valid initial state', () => {
      createMachine({
        initial: 'a',
        states: { a: {}, b: {} }
      });
    });

    it('should accept any string for initial (backward compat)', () => {
      createMachine({
        initial: 'nonExistent',
        states: { a: {}, b: {} }
      });
    });

    // --- nested states ---
    it('should constrain nested state targets to their siblings', () => {
      createMachine({
        initial: 'parent',
        states: {
          parent: {
            initial: 'child1',
            states: {
              child1: { on: { GO: { target: 'child2' } } },
              child2: {}
            }
          }
        }
      });
    });

    it('should reject invalid nested targets', () => {
      expect(() => {
        createMachine({
          initial: 'parent',
          states: {
            parent: {
              initial: 'child1',
              states: {
                child1: {
                  on: {
                    // @ts-expect-error - 'nonExistent' is not a valid sibling of child1
                    GO: 'nonExistent'
                  }
                },
                child2: {}
              }
            }
          }
        });
      }).toThrow();
    });

    // --- spread variable escape hatch ---
    it('should accept spread variables with widened targets', () => {
      const pedestrianStates = {
        walk: { on: { TIMER: { target: 'wait' } } },
        wait: {}
      };
      createMachine({
        initial: 'green',
        states: {
          green: {
            initial: 'walk',
            states: { ...pedestrianStates, stop: {} }
          }
        }
      });
    });
  });

  describe('setup().createMachine', () => {
    // --- on: bare string ---
    it('should allow valid bare string target in on', () => {
      setup({
        types: {} as { events: { type: 'GO' } }
      }).createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: 'b' } },
          b: {}
        }
      });
    });

    it('should reject invalid bare string target in on', () => {
      expect(() => {
        setup({
          types: {} as { events: { type: 'GO' } }
        }).createMachine({
          initial: 'a',
          states: {
            a: {
              on: {
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                GO: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    // --- on: object-form ---
    it('should allow valid object-form target in on', () => {
      setup({
        types: {} as { events: { type: 'GO' } }
      }).createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: { target: 'b' } } },
          b: {}
        }
      });
    });

    it('should reject invalid object-form target in on', () => {
      expect(() => {
        setup({
          types: {} as { events: { type: 'GO' } }
        }).createMachine({
          initial: 'a',
          states: {
            a: {
              on: {
                GO: {
                  // @ts-expect-error - 'nonExistent' is not a valid sibling state
                  target: 'nonExistent'
                }
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    // --- on: array of objects ---
    it('should allow valid array of object-form targets in on', () => {
      setup({
        types: {} as { events: { type: 'GO' } }
      }).createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: [{ target: 'b' }, { target: 'c' }] } },
          b: {},
          c: {}
        }
      });
    });

    it('should reject invalid target in array of objects in on', () => {
      expect(() => {
        setup({
          types: {} as { events: { type: 'GO' } }
        }).createMachine({
          initial: 'a',
          states: {
            a: {
              on: {
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                GO: [
                  { target: 'b' },
                  { target: 'nonExistent' }
                ]
              }
            },
            b: {},
            c: {}
          }
        });
      }).toThrow();
    });

    // --- always ---
    it('should allow valid always target (object-form)', () => {
      setup({}).createMachine({
        initial: 'a',
        states: {
          a: { always: { target: 'b' } },
          b: {}
        }
      });
    });

    it('should allow valid always target (bare string)', () => {
      setup({}).createMachine({
        initial: 'a',
        states: {
          a: { always: 'b' },
          b: {}
        }
      });
    });

    it('should reject invalid always target (bare string)', () => {
      expect(() => {
        setup({}).createMachine({
          initial: 'a',
          states: {
            a: {
              // @ts-expect-error - 'nonExistent' is not a valid sibling state
              always: 'nonExistent'
            },
            b: {}
          }
        });
      }).toThrow();
    });

    it('should reject invalid always target (object-form)', () => {
      expect(() => {
        setup({}).createMachine({
          initial: 'a',
          states: {
            a: {
              always: {
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                target: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    // --- after ---
    it('should allow valid after target (bare string)', () => {
      setup({}).createMachine({
        initial: 'a',
        states: {
          a: { after: { 1000: 'b' } },
          b: {}
        }
      });
    });

    it('should allow valid after target (object-form)', () => {
      setup({}).createMachine({
        initial: 'a',
        states: {
          a: { after: { 1000: { target: 'b' } } },
          b: {}
        }
      });
    });

    it('should reject invalid after target (bare string)', () => {
      expect(() => {
        setup({}).createMachine({
          initial: 'a',
          states: {
            a: {
              after: {
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                1000: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    it('should reject invalid after target (object-form)', () => {
      expect(() => {
        setup({}).createMachine({
          initial: 'a',
          states: {
            a: {
              after: {
                1000: {
                  // @ts-expect-error - 'nonExistent' is not a valid sibling state
                  target: 'nonExistent'
                }
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    // --- onDone on state nodes ---
    it('should allow valid onDone target (bare string)', () => {
      setup({}).createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'child',
            states: { child: { type: 'final' } },
            onDone: 'b'
          },
          b: {}
        }
      });
    });

    it('should allow valid onDone target (object-form)', () => {
      setup({}).createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'child',
            states: { child: { type: 'final' } },
            onDone: { target: 'b' }
          },
          b: {}
        }
      });
    });

    it('should reject invalid onDone target (bare string)', () => {
      expect(() => {
        setup({}).createMachine({
          initial: 'a',
          states: {
            a: {
              // @ts-expect-error - 'nonExistent' is not a valid sibling state
              onDone: 'nonExistent'
            },
            b: {}
          }
        });
      }).toThrow();
    });

    it('should reject invalid onDone target (object-form)', () => {
      expect(() => {
        setup({}).createMachine({
          initial: 'a',
          states: {
            a: {
              onDone: {
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                target: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    // --- invoke.onDone / invoke.onError ---
    it('should allow valid invoke.onDone target', () => {
      setup({
        actors: { myActor: fromPromise(() => Promise.resolve()) }
      }).createMachine({
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: 'myActor',
              onDone: { target: 'b' }
            }
          },
          b: {}
        }
      });
    });

    it('should allow valid invoke.onError target', () => {
      setup({
        actors: { myActor: fromPromise(() => Promise.resolve()) }
      }).createMachine({
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: 'myActor',
              onError: { target: 'b' }
            }
          },
          b: {}
        }
      });
    });

    it('should allow valid invoke.onDone bare string target', () => {
      setup({
        actors: { myActor: fromPromise(() => Promise.resolve()) }
      }).createMachine({
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: 'myActor',
              onDone: 'b'
            }
          },
          b: {}
        }
      });
    });

    it('should allow valid invoke.onError bare string target', () => {
      setup({
        actors: { myActor: fromPromise(() => Promise.resolve()) }
      }).createMachine({
        initial: 'a',
        states: {
          a: {
            invoke: {
              src: 'myActor',
              onError: 'b'
            }
          },
          b: {}
        }
      });
    });

    // --- target patterns ---
    it('should allow dot-prefixed child targets', () => {
      setup({
        types: {} as { events: { type: 'GO' } }
      }).createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'child',
            states: { child: {} },
            on: { GO: { target: '.child' } }
          },
          b: {}
        }
      });
    });

    it('should allow hash-prefixed id targets', () => {
      setup({
        types: {} as { events: { type: 'GO' } }
      }).createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: { target: '#myB' } } },
          b: { id: 'myB' }
        }
      });
    });

    it('should allow dot-path sibling targets', () => {
      setup({
        types: {} as { events: { type: 'GO' } }
      }).createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: { target: 'b.nested' } } },
          b: {
            initial: 'nested',
            states: { nested: {} }
          }
        }
      });
    });

    it('should allow escaped dot targets for state names with dots', () => {
      setup({
        types: {} as { events: { type: 'GO' } }
      }).createMachine({
        initial: 'a',
        states: {
          a: { on: { GO: 'foo\\.bar' } },
          'foo.bar': {}
        }
      });
    });

    // --- nested states ---
    it('should constrain nested state targets to their siblings', () => {
      setup({
        types: {} as { events: { type: 'GO' } }
      }).createMachine({
        initial: 'parent',
        states: {
          parent: {
            initial: 'child1',
            states: {
              child1: { on: { GO: { target: 'child2' } } },
              child2: {}
            }
          }
        }
      });
    });

    it('should reject invalid nested targets', () => {
      expect(() => {
        setup({
          types: {} as { events: { type: 'GO' } }
        }).createMachine({
          initial: 'parent',
          states: {
            parent: {
              initial: 'child1',
              states: {
                child1: {
                  on: {
                    // @ts-expect-error - 'nonExistent' is not a valid sibling of child1
                    GO: 'nonExistent'
                  }
                },
                child2: {}
              }
            }
          }
        });
      }).toThrow();
    });

    // --- initial ---
    it('should accept any string for initial (backward compat)', () => {
      setup({}).createMachine({
        initial: 'nonExistent',
        states: { idle: {}, loading: {} }
      });
    });

    // --- spread variable escape hatch ---
    it('should accept spread variables with widened targets', () => {
      const pedestrianStates = {
        walk: { on: { TIMER: { target: 'wait' } } },
        wait: {}
      };
      setup({
        types: {} as { events: { type: 'TIMER' } }
      }).createMachine({
        initial: 'green',
        states: {
          green: {
            initial: 'walk',
            states: { ...pedestrianStates, stop: {} }
          }
        }
      });
    });
  });
});
