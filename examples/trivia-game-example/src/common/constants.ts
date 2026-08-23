export const RICK_AND_MORTY_API = 'https://rickandmortyapi.com/api/character';

/** Returns a random integer in `[1, max]`. Character/page ids are 1-based. */
export function getRandomNumber(max = 400): number {
  return Math.floor(Math.random() * max) + 1;
}
