import { describe, it, expect } from 'vitest';
import { createMachine } from '../src/createMachine';
import { setup } from '../src/setup';

describe('type-safe state names', () => {
  describe('createMachine', () => {
    it('should allow valid sibling targets in on transitions', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: { target: 'b' }
            }
          },
          b: {}
        }
      });
    });

    it('should reject invalid bare string targets in createMachine', () => {
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

    it('should reject invalid object-form targets in createMachine', () => {
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

    it('should allow valid initial state', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {},
          b: {}
        }
      });
    });

    it('should accept any string for initial (backward compat with spread/variables)', () => {
      createMachine({
        initial: 'nonExistent', // accepted as string for backward compat
        states: {
          a: {},
          b: {}
        }
      });
    });

    it('should allow dot-prefixed child targets', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            initial: 'child',
            states: {
              child: {}
            },
            on: {
              GO: { target: '.child' }
            }
          },
          b: {}
        }
      });
    });

    it('should allow hash-prefixed id targets', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: { target: '#myB' }
            }
          },
          b: {
            id: 'myB'
          }
        }
      });
    });

    it('should allow dot-path sibling targets', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: { target: 'b.nested' }
            }
          },
          b: {
            initial: 'nested',
            states: {
              nested: {}
            }
          }
        }
      });
    });

    it('should allow string target shorthand in on transitions', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: 'b'
            }
          },
          b: {}
        }
      });
    });

    it('should constrain nested state targets to their siblings', () => {
      createMachine({
        initial: 'parent',
        states: {
          parent: {
            initial: 'child1',
            states: {
              child1: {
                on: {
                  GO: { target: 'child2' }
                }
              },
              child2: {}
            }
          }
        }
      });
    });

    it('should reject invalid nested targets in createMachine', () => {
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

    it('should constrain always targets', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            always: { target: 'b' }
          },
          b: {}
        }
      });
    });

    it('should allow valid after targets', () => {
      createMachine({
        initial: 'a',
        states: {
          a: {
            after: {
              1000: 'b'
            }
          },
          b: {}
        }
      });
    });
  });

  describe('setup().createMachine', () => {
    it('should allow valid targets in setup machine transitions', () => {
      setup({
        types: {} as {
          events: { type: 'GO' };
        }
      }).createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: { target: 'b' }
            }
          },
          b: {}
        }
      });
    });

    it('should reject invalid bare string targets in setup', () => {
      expect(() => {
        setup({
          types: {} as {
            events: { type: 'GO' };
          }
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

    it('should reject invalid object-form targets in setup', () => {
      expect(() => {
        setup({
          types: {} as {
            events: { type: 'GO' };
          }
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

    it('should allow valid string shorthand targets in setup', () => {
      setup({
        types: {} as {
          events: { type: 'GO' };
        }
      }).createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: 'b'
            }
          },
          b: {}
        }
      });
    });

    it('should allow dot-prefixed targets in setup', () => {
      setup({
        types: {} as {
          events: { type: 'GO' };
        }
      }).createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: { target: '.child' }
            },
            initial: 'child',
            states: {
              child: {}
            }
          },
          b: {}
        }
      });
    });

    it('should allow hash-prefixed targets in setup', () => {
      setup({
        types: {} as {
          events: { type: 'GO' };
        }
      }).createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: { target: '#myB' }
            }
          },
          b: {
            id: 'myB'
          }
        }
      });
    });

    it('should constrain nested state targets in setup', () => {
      setup({
        types: {} as {
          events: { type: 'GO' };
        }
      }).createMachine({
        initial: 'parent',
        states: {
          parent: {
            initial: 'child1',
            states: {
              child1: {
                on: {
                  GO: { target: 'child2' }
                }
              },
              child2: {}
            }
          }
        }
      });
    });

    it('should reject invalid nested targets in setup', () => {
      expect(() => {
        setup({
          types: {} as {
            events: { type: 'GO' };
          }
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

    it('should accept any string for initial in setup (backward compat)', () => {
      setup({}).createMachine({
        initial: 'nonExistent', // accepted as string for backward compat
        states: {
          idle: {},
          loading: {}
        }
      });
    });
  });
});
