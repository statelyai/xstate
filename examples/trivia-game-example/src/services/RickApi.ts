import axios from 'axios';
import { RICK_AND_MORTY_API, getRandomNumber } from '../common/constants';
import { RMCharacter, RMEpisode } from '../common/types';

// Errors are deliberately NOT caught here: the machine turns a rejected
// promise into an `onError` transition and a visible error state.
const get = async <T>(url: string): Promise<T> => {
  const response = await axios.get<T>(url);
  return response.data;
};

export const RickCharacters = {
  getCharacters: (page: number) =>
    get<{ results: RMCharacter[] }>(`${RICK_AND_MORTY_API}/?page=${page}`).then(
      (data) => data.results
    ),

  getCharacter: (character: number) =>
    get<RMCharacter>(`${RICK_AND_MORTY_API}/${character}`),

  getRandomCharacters: () =>
    get<RMCharacter[]>(
      `${RICK_AND_MORTY_API}/${getRandomNumber()},${getRandomNumber()},${getRandomNumber()}`
    ),

  getClue: (episode: string) => get<RMEpisode>(episode)
};
