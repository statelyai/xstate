const RICK_AND_MORTY_API = 'https://rickandmortyapi.com/api/character';

export { RICK_AND_MORTY_API };

export function getRandomNumber(): number {
  return 1 + Math.floor(Math.random() * 400);
}
