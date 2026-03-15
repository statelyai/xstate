import { describe, expect, it } from 'vitest';
import { fromPromise } from '../src/actors/promise';
import { createMachine } from '../src/createMachine';
import { setup } from '../src/setup';

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
                GO: [{ target: 'b' }, { target: 'nonExistent' }]
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

    it('should reject invalid always target (array of objects)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              // @ts-expect-error - 'nonExistent' is not a valid sibling state
              always: [{ target: 'b' }, { target: 'nonExistent' }]
            },
            b: {},
            c: {}
          }
        });
      }).toThrow();
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

    it('should reject invalid invoke.onDone target (object-form)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              invoke: {
                src: fromPromise(() => Promise.resolve()),
                onDone: {
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

    it('should reject invalid invoke.onDone target (bare string)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              invoke: {
                // @ts-expect-error - bare string onDone collapses invoke type
                src: fromPromise(() => Promise.resolve()),
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                onDone: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    it('should reject invalid invoke.onDone target (object-form)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              invoke: {
                src: fromPromise(() => Promise.resolve()),
                onDone: {
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

    it('should reject invalid invoke.onError target (object-form)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              invoke: {
                src: fromPromise(() => Promise.resolve()),
                onError: {
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

    it('should reject invalid invoke.onError target (bare string)', () => {
      expect(() => {
        createMachine({
          initial: 'a',
          states: {
            a: {
              invoke: {
                // @ts-expect-error - bare string onError collapses invoke type
                src: fromPromise(() => Promise.resolve()),
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                onError: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
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

    // --- root-level on (no siblings) ---
    // Note: root-level target validation only works with setup().createMachine
    // because createMachine cannot use `const TConfig` without affecting context inference.
    // Runtime validation still catches invalid root targets for createMachine.
    it('should allow dot-prefixed child target in root-level on', () => {
      createMachine({
        initial: 'STATE_A',
        on: {
          CANCEL: '.END'
        },
        states: {
          STATE_A: {},
          END: { type: 'final' }
        }
      });
    });

    it('should allow hash-prefixed id target in root-level on', () => {
      createMachine({
        initial: 'STATE_A',
        on: {
          CANCEL: '#myEnd'
        },
        states: {
          STATE_A: {},
          END: { type: 'final', id: 'myEnd' }
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
                GO: [{ target: 'b' }, { target: 'nonExistent' }]
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

    it('should allow valid always target (array of objects)', () => {
      setup({}).createMachine({
        initial: 'a',
        states: {
          a: { always: [{ target: 'b' }, { target: 'c' }] },
          b: {},
          c: {}
        }
      });
    });

    it('should reject invalid always target (array of objects)', () => {
      expect(() => {
        setup({}).createMachine({
          initial: 'a',
          states: {
            a: {
              // @ts-expect-error - 'nonExistent' is not a valid sibling state
              always: [{ target: 'b' }, { target: 'nonExistent' }]
            },
            b: {},
            c: {}
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

    it('should reject invalid invoke.onDone target (bare string)', () => {
      expect(() => {
        setup({
          actors: { myActor: fromPromise(() => Promise.resolve()) }
        }).createMachine({
          initial: 'a',
          states: {
            a: {
              invoke: {
                // @ts-expect-error - bare string onDone collapses invoke type
                src: 'myActor',
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                onDone: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
    });

    it('should reject invalid invoke.onDone target (object-form)', () => {
      expect(() => {
        setup({
          actors: { myActor: fromPromise(() => Promise.resolve()) }
        }).createMachine({
          initial: 'a',
          states: {
            a: {
              invoke: {
                src: 'myActor',
                onDone: {
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

    it('should reject invalid invoke.onError target (object-form)', () => {
      expect(() => {
        setup({
          actors: { myActor: fromPromise(() => Promise.resolve()) }
        }).createMachine({
          initial: 'a',
          states: {
            a: {
              invoke: {
                src: 'myActor',
                onError: {
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

    it('should reject invalid invoke.onError target (bare string)', () => {
      expect(() => {
        setup({
          actors: { myActor: fromPromise(() => Promise.resolve()) }
        }).createMachine({
          initial: 'a',
          states: {
            a: {
              invoke: {
                // @ts-expect-error - bare string onError collapses invoke type
                src: 'myActor',
                // @ts-expect-error - 'nonExistent' is not a valid sibling state
                onError: 'nonExistent'
              }
            },
            b: {}
          }
        });
      }).toThrow();
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

    // --- root-level on (no siblings) ---
    it('should allow dot-prefixed child target in root-level on', () => {
      setup({
        types: {} as { events: { type: 'CANCEL' } }
      }).createMachine({
        initial: 'STATE_A',
        on: {
          CANCEL: '.END'
        },
        states: {
          STATE_A: {},
          END: { type: 'final' }
        }
      });
    });

    it('should allow hash-prefixed id target in root-level on', () => {
      setup({
        types: {} as { events: { type: 'CANCEL' } }
      }).createMachine({
        initial: 'STATE_A',
        on: {
          CANCEL: '#myEnd'
        },
        states: {
          STATE_A: {},
          END: { type: 'final', id: 'myEnd' }
        }
      });
    });

    it('should reject bare string target in root-level on', () => {
      expect(() => {
        setup({
          types: {} as { events: { type: 'CANCEL' } }
        }).createMachine({
          initial: 'STATE_A',
          on: {
            // @ts-expect-error - bare sibling target invalid at root level (root has no siblings)
            CANCEL: 'END'
          },
          states: {
            STATE_A: {},
            END: { type: 'final' }
          }
        });
      }).toThrow();
    });

    it('should reject bare string target in root-level on (object-form)', () => {
      expect(() => {
        setup({
          types: {} as { events: { type: 'CANCEL' } }
        }).createMachine({
          initial: 'STATE_A',
          on: {
            CANCEL: {
              // @ts-expect-error - bare sibling target invalid at root level (root has no siblings)
              target: 'END'
            }
          },
          states: {
            STATE_A: {},
            END: { type: 'final' }
          }
        });
      }).toThrow();
    });

    it('should reject object-form target in root-level always', () => {
      expect(() => {
        setup({}).createMachine({
          initial: 'STATE_A',
          always: {
            // @ts-expect-error - bare sibling target invalid at root level (root has no siblings)
            target: 'END'
          },
          states: {
            STATE_A: {},
            END: { type: 'final' }
          }
        });
      }).toThrow();
    });

    it('should reject bare string target in root-level after', () => {
      expect(() => {
        setup({}).createMachine({
          initial: 'STATE_A',
          after: {
            // @ts-expect-error - bare sibling target invalid at root level (root has no siblings)
            1000: 'END'
          },
          states: {
            STATE_A: {},
            END: { type: 'final' }
          }
        });
      }).toThrow();
    });
  });
});
