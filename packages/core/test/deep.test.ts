import { createMachine, createActor } from '../src/index.ts';
import { trackEntries } from './utils.ts';

describe('deep transitions', () => {
  describe('exiting super/substates', () => {
    it('should exit all substates when superstates exits', () => {
      const machine = createMachine({
        id: 'root',
        initial: 'A',
        states: {
          DONE: {},
          FAIL: {},
          A: {
            on: {
              A_EVENT: '#root.DONE'
            },
            initial: 'B',
            states: {
              B: {
                initial: 'C',
                states: {
                  C: {
                    initial: 'D',
                    states: {
                      D: {}
                    }
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({
        type: 'A_EVENT'
      });

      expect(flushTracked()).toEqual([
        'exit: A.B.C.D',
        'exit: A.B.C',
        'exit: A.B',
        'exit: A',
        'enter: DONE'
      ]);
    });

    it('should exit substates and superstates when exiting (B_EVENT)', () => {
      const machine = createMachine({
        id: 'root',
        initial: 'A',
        states: {
          DONE: {},
          A: {
            initial: 'B',
            states: {
              B: {
                on: {
                  B_EVENT: '#root.DONE'
                },
                initial: 'C',
                states: {
                  C: {
                    initial: 'D',
                    states: {
                      D: {}
                    }
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({
        type: 'B_EVENT'
      });

      expect(flushTracked()).toEqual([
        'exit: A.B.C.D',
        'exit: A.B.C',
        'exit: A.B',
        'exit: A',
        'enter: DONE'
      ]);
    });

    it('should exit substates and superstates when exiting (C_EVENT)', () => {
      const machine = createMachine({
        id: 'root',
        initial: 'A',
        states: {
          DONE: {},
          A: {
            initial: 'B',
            states: {
              B: {
                initial: 'C',
                states: {
                  C: {
                    on: {
                      C_EVENT: '#root.DONE'
                    },
                    initial: 'D',
                    states: {
                      D: {}
                    }
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({
        type: 'C_EVENT'
      });

      expect(flushTracked()).toEqual([
        'exit: A.B.C.D',
        'exit: A.B.C',
        'exit: A.B',
        'exit: A',
        'enter: DONE'
      ]);
    });

    it('should exit superstates when exiting (D_EVENT)', () => {
      const machine = createMachine({
        id: 'root',
        initial: 'A',
        states: {
          DONE: {},
          A: {
            initial: 'B',
            states: {
              B: {
                initial: 'C',
                states: {
                  C: {
                    initial: 'D',
                    states: {
                      D: {
                        on: {
                          D_EVENT: '#root.DONE'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({
        type: 'D_EVENT'
      });

      expect(flushTracked()).toEqual([
        'exit: A.B.C.D',
        'exit: A.B.C',
        'exit: A.B',
        'exit: A',
        'enter: DONE'
      ]);
    });

    it('should exit substate when machine handles event (MACHINE_EVENT)', () => {
      const machine = createMachine({
        id: 'deep',
        initial: 'A',
        on: {
          MACHINE_EVENT: '#deep.DONE'
        },
        states: {
          DONE: {},
          A: {
            initial: 'B',
            states: {
              B: {
                initial: 'C',
                states: {
                  C: {
                    initial: 'D',
                    states: {
                      D: {}
                    }
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({
        type: 'MACHINE_EVENT'
      });

      expect(flushTracked()).toEqual([
        'exit: A.B.C.D',
        'exit: A.B.C',
        'exit: A.B',
        'exit: A',
        'enter: DONE'
      ]);
    });

    it('should exit deep and enter deep (A_S)', () => {
      const machine = createMachine({
        id: 'root',
        initial: 'A',
        states: {
          A: {
            on: {
              A_S: '#root.P.Q.R.S'
            },
            initial: 'B',
            states: {
              B: {
                initial: 'C',
                states: {
                  C: {
                    initial: 'D',
                    states: {
                      D: {}
                    }
                  }
                }
              }
            }
          },
          P: {
            initial: 'Q',
            states: {
              Q: {
                initial: 'R',
                states: {
                  R: {
                    initial: 'S',
                    states: {
                      S: {}
                    }
                  }
                }
              }
            }
          }
        }
      });
      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({
        type: 'A_S'
      });

      expect(flushTracked()).toEqual([
        'exit: A.B.C.D',
        'exit: A.B.C',
        'exit: A.B',
        'exit: A',
        'enter: P',
        'enter: P.Q',
        'enter: P.Q.R',
        'enter: P.Q.R.S'
      ]);
    });

    it('should exit deep and enter deep (D_P)', () => {
      const machine = createMachine({
        id: 'deep',
        initial: 'A',
        states: {
          A: {
            initial: 'B',
            states: {
              B: {
                initial: 'C',
                states: {
                  C: {
                    initial: 'D',
                    states: {
                      D: {
                        on: {
                          D_P: '#deep.P'
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          P: {
            initial: 'Q',
            states: {
              Q: {
                initial: 'R',
                states: {
                  R: {
                    initial: 'S',
                    states: {
                      S: {}
                    }
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({
        type: 'D_P'
      });

      expect(flushTracked()).toEqual([
        'exit: A.B.C.D',
        'exit: A.B.C',
        'exit: A.B',
        'exit: A',
        'enter: P',
        'enter: P.Q',
        'enter: P.Q.R',
        'enter: P.Q.R.S'
      ]);
    });

    it('should exit deep and enter deep when targeting an ancestor of the final resolved deep target', () => {
      const machine = createMachine({
        id: 'root',
        initial: 'A',
        states: {
          A: {
            on: {
              A_P: '#root.P'
            },
            initial: 'B',
            states: {
              B: {
                initial: 'C',
                states: {
                  C: {
                    initial: 'D',
                    states: {
                      D: {}
                    }
                  }
                }
              }
            }
          },
          P: {
            initial: 'Q',
            states: {
              Q: {
                initial: 'R',
                states: {
                  R: {
                    initial: 'S',
                    states: {
                      S: {}
                    }
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({
        type: 'A_P'
      });

      expect(flushTracked()).toEqual([
        'exit: A.B.C.D',
        'exit: A.B.C',
        'exit: A.B',
        'exit: A',
        'enter: P',
        'enter: P.Q',
        'enter: P.Q.R',
        'enter: P.Q.R.S'
      ]);
    });

    it('should exit deep and enter deep when targeting a deep state', () => {
      const machine = createMachine({
        id: 'root',
        initial: 'A',
        states: {
          A: {
            initial: 'B',
            states: {
              B: {
                initial: 'C',
                states: {
                  C: {
                    initial: 'D',
                    states: {
                      D: {
                        on: {
                          D_S: '#root.P.Q.R.S'
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          P: {
            initial: 'Q',
            states: {
              Q: {
                initial: 'R',
                states: {
                  R: {
                    initial: 'S',
                    states: {
                      S: {}
                    }
                  }
                }
              }
            }
          }
        }
      });

      const flushTracked = trackEntries(machine);

      const actor = createActor(machine).start();
      flushTracked();

      actor.send({
        type: 'D_S'
      });

      expect(flushTracked()).toEqual([
        'exit: A.B.C.D',
        'exit: A.B.C',
        'exit: A.B',
        'exit: A',
        'enter: P',
        'enter: P.Q',
        'enter: P.Q.R',
        'enter: P.Q.R.S'
      ]);
    });
  });
});
