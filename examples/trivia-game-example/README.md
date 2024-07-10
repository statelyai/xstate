# Trivia Game Rick & Morty

This app is a trivia game based on the Rick & Morty characters. The user has to select the right character based on a single image and four different options. The rules are the following:

- The user has 3 lifes and zero points at the start
- If the user guesses the character correctly then 10 points will be awarded
- If the user makes an incorrect guess then one life will be taken
- The user has one clue for each question
- The game is won by achieving 100 points
- The game is lost if all lifes are lost
- You can reset and play again after losing or winning

## Machine Context

In order for the machine to work, we need to define first the context for it. The context has all the variables needed that the machine can access and modify.
<img width="504" alt="image" src="https://github.com/natar10/trivia-rm/assets/12553364/c1ab0219-d76a-4b9b-b087-4e36094991be">

## States and transitions

A machine is composed of states. Each state defines where the app can be, and also the logic that can be applied. If we need to move to another state, we call a transition. The transitions define the destination and origin state to where the app can go to.
For example:
<img width="734" alt="image" src="https://github.com/natar10/trivia-rm/assets/12553364/29d90483-0366-4a3c-b7b7-c071c63e4579">

Here we have our initial state: `questionStart`. To move to another state, we use the transition `user.selectAnswer`. If the answer is correct we'll go to the `correctAnswer` state, otherwise we'll end up in the `incorrectAnswer` state.

You can see the complete machine for this project [here](https://stately.ai/registry/editor/f64904b1-65f9-4946-aace-ddfc9fd05c29?machineId=aec325d6-2d51-4334-afc4-f2c02a67aa05)

### Installation

Install all required packages with:

```bash
pnpm install
```

### Development

Start the development server on http://localhost:5173

```bash
yarn dev
```
