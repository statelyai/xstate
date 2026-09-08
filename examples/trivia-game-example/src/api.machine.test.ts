import { afterEach, expect, it, vi } from 'vitest';
import axios from 'axios';
import { RickCharacters } from './services/RickApi';
import { getRandomNumber } from './common/constants';

afterEach(() => vi.restoreAllMocks());
it('uses valid IDs and three distinct distractors excluding the answer', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  expect(getRandomNumber()).toBe(1);
  const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: [] });
  const controller = new AbortController();
  await RickCharacters.getRandomCharacters(1, controller.signal);
  expect(get).toHaveBeenCalledExactlyOnceWith(
    'https://rickandmortyapi.com/api/character/2,3,4',
    { signal: controller.signal }
  );
});
it('propagates loading failures to the machine', async () => {
  const failure = new Error('offline');
  vi.spyOn(axios, 'get').mockRejectedValue(failure);
  await expect(RickCharacters.getCharacters(1)).rejects.toBe(failure);
  await expect(RickCharacters.getCharacter(1)).rejects.toBe(failure);
});
