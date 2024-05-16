import { RICK_AND_MORTY_API, getRandomNumber } from "../common/constants";
import axios from "axios";
import { RMCharacter, RMEpisode } from "../common/types";

class RickCharactersImpl {
  public getCharacters(page: number): Promise<RMCharacter[]> {
    return axios
      .get(`${RICK_AND_MORTY_API}/?page=${page}`)
      .then((response) => response.data.results)
      .catch((err) => {
        console.log(err);
      });
  }

  public getCharacter(character: number): Promise<RMCharacter> {
    return axios
      .get(`${RICK_AND_MORTY_API}/${character}`)
      .then((response) => response.data)
      .catch((err) => {
        console.log(err);
      });
  }

  public getRandomCharacters(): Promise<RMCharacter[]> {
    return axios
      .get(
        `${RICK_AND_MORTY_API}/${getRandomNumber()},${getRandomNumber()},${getRandomNumber()}`
      )
      .then((response) => response.data)
      .catch((err) => {
        console.log(err);
      });
  }

  public getClue(episode: string): Promise<RMEpisode> {
    return axios
      .get(episode)
      .then((response) => response.data)
      .catch((err) => {
        console.log(err);
      });
  }
}

export const RickCharacters = new RickCharactersImpl();
