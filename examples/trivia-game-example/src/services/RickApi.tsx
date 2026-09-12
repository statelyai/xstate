import { RICK_AND_MORTY_API } from '../common/constants';
import axios from 'axios';
import { RMCharacter, RMEpisode } from '../common/types';

class RickCharactersImpl {
  public getCharacters(
    page: number,
    signal?: AbortSignal
  ): Promise<RMCharacter[]> {
    return axios
      .get(`${RICK_AND_MORTY_API}/?page=${page}`, { signal })
      .then((response) => response.data.results);
  }

  public getCharacter(
    character: number,
    signal?: AbortSignal
  ): Promise<RMCharacter> {
    return axios
      .get(`${RICK_AND_MORTY_API}/${character}`, { signal })
      .then((response) => response.data);
  }

  public getRandomCharacters(
    excludeId: number,
    signal?: AbortSignal
  ): Promise<RMCharacter[]> {
    const available = Array.from({ length: 400 }, (_, i) => i + 1).filter(
      (id) => id !== excludeId
    );
    const ids: number[] = [];
    for (let i = 0; i < 3; i++)
      ids.push(
        available.splice(Math.floor(Math.random() * available.length), 1)[0]
      );
    return axios
      .get(`${RICK_AND_MORTY_API}/${ids.join(',')}`, { signal })
      .then((response) => response.data);
  }

  public getClue(episode: string): Promise<RMEpisode> {
    return axios.get(episode).then((response) => response.data);
  }
}

export const RickCharacters = new RickCharactersImpl();
