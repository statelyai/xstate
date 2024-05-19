import { assertEvent, assign, fromPromise, not, setup } from "xstate";
import { RMCharacter } from "./common/types";
import { RickCharacters } from "./services/RickApi";
import { getRandomNumber } from "./common/constants";;

const triviaMachine = setup({
    types: {
        events: {} as 
        | { type: "user.play"} 
        | { type: "user.close"} 
        | { type: "user.reject"}
        | { type: "user.accept"}
        | { 
            type: "user.selectAnswer",
            answer: number
        }
        | { type: "user.nextQuestion"}
        | { type: "user.toggleClue"}
        | { type: "user.playAgain"},
        context: {} as {
            homePageCharacters: Array<RMCharacter>
            hasLoaded: boolean
            currentCharacter: RMCharacter | null
            randomCharacters: Array<RMCharacter>
            isClueOpened: boolean
            points: number
            question: number
            lifes: number
        }
    },
    guards: {
        isAnswerCorrect: ({context, event}) => {
            assertEvent(event, 'user.selectAnswer');
            if(!context.currentCharacter) return false
            return event.answer === context.currentCharacter.id
        },
        hasLostGame: ({context}) => {
            return context.lifes <= 0
        },
        hasWonGame: ({context}) => {
            return context.points >= 100
        }
    },
    actions: {
        goToTriviaPage: () => {},
        resetTriviaData: assign({
            currentCharacter: null,
            randomCharacters: [],
            points: 0,
            question: 0,
            lifes: 3
        })
    },
    actors: {
        loadHomePageCharacters: fromPromise(() => RickCharacters.getCharacters(Math.floor(Math.random() * 34))),
        loadSingleCharacter: fromPromise(async () => {
            const randomNumber = getRandomNumber();
            const character = await RickCharacters.getCharacter(randomNumber)
            return character;
        }),
        loadRandomCharacters: fromPromise(() => RickCharacters.getRandomCharacters())
    }
}).createMachine({
    id: "triviaMachine",
    initial: "homepage",
    context: {
        homePageCharacters: [],
        hasLoaded: false,
        currentCharacter: null,
        randomCharacters: [],
        isClueOpened: false,
        points: 0,
        question: 0,
        lifes: 3
    },
    states: {
        homepage: {
            initial: "loadingData",
            states: {
                loadingData: {
                    invoke: {
                        src: 'loadHomePageCharacters',
                        onDone: {
                            actions: assign({
                                homePageCharacters: (({event}) => event.output),
                                hasLoaded: true
                            }),
                            target: "dataLoaded"
                        }, 
                    },
                },
                dataLoaded: {
                    on: {
                        "user.play": {
                            target: "#instructionModal"
                        }
                    }
                }
            },
        },
        instructionModal: {
            id: "instructionModal",
            on: {
                "user.close": {
                    target: "homepage.dataLoaded"
                },
                "user.reject": {
                    target: "homepage.dataLoaded"
                },
                "user.accept": {
                    target: "startTrivia",
                    actions: assign({
                        hasLoaded: false
                    })
                }
            }
        },
        startTrivia: {
            initial: "loadQuestionData",
            id: "startTrivia",
            entry: ["goToTriviaPage", "resetTriviaData"],
            states: {
                loadQuestionData: {
                    id: "loadQuestionData",
                    initial: "loadCharacter",
                    entry:  assign({
                        hasLoaded:false,
                    }),
                    states: {
                        loadCharacter: {
                            invoke: {
                                src: "loadSingleCharacter",
                                onDone: {
                                    actions: assign({
                                        currentCharacter: (({event}) => event.output),
                                    }),
                                    target: "loadRandomCharacters"
                                }
                            }
                        },
                        loadRandomCharacters: {
                            invoke: {
                                src: "loadRandomCharacters",
                                onDone: {
                                    actions: assign({
                                        randomCharacters: (({event}) => event.output),
                                        question: (({context}) => context.question + 1),
                                        hasLoaded: true
                                    }),
                                    target: "#questionReady"
                                }
                            },
                            
                        }
                    }
                },
                questionReady: {
                    id: "questionReady",
                    initial: "questionStart",
                    on: {
                        "user.toggleClue": {
                            actions: assign(({context}) => {
                                return {
                                    isClueOpened: !context.isClueOpened
                                }
                            })
                        },
                    },
                    states: {
                        questionStart: {
                            on: {
                                "user.selectAnswer": [
                                    {
                                        target: "correctAnswer",
                                        guard: "isAnswerCorrect"
                                    },
                                    {
                                        target: "incorrectAnswer",
                                        guard: not("isAnswerCorrect")
                                    },
                                ]
                            }
                        },
                        correctAnswer: {
                            entry: assign({
                                points:({context}) => context.points + 10,
                            }),
                            always: [
                                {
                                    guard: "hasLostGame",
                                    target: "lostGame"
                                },
                                {
                                    guard: "hasWonGame",
                                    target: "wonGame"
                                }
                             ],
                            on: {
                                "user.nextQuestion": {
                                    target: "#loadQuestionData"
                                }
                            }
                        },
                        incorrectAnswer:{
                            entry: assign({
                                lifes: (({context}) => context.lifes - 1),
                            }),
                            always: [
                                {
                                    guard: "hasLostGame",
                                    target: "lostGame"
                                },
                                {
                                    guard: "hasWonGame",
                                    target: "wonGame"
                                }
                             ],
                            on: {
                                "user.nextQuestion": {
                                    target: "#loadQuestionData"
                                }
                            }
                        },
                        lostGame: {
                            on: {
                                "user.playAgain": {
                                    target: "#startTrivia"
                                }
                            }
                        },
                        wonGame: {
                            on: {
                                "user.playAgain": {
                                    target: "#startTrivia"
                                }
                            }
                        }
                    }
                }
            },
        }
    }
})

export default triviaMachine