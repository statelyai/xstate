import { afterEach, expect, it, vi } from 'vitest';
import { createActor, waitFor } from 'xstate';
import triviaMachine from './triviaMachine';
import { RickCharacters } from './services/RickApi';
import type { RMCharacter } from './common/types';

vi.mock('./services/RickApi', () => ({
  RickCharacters: {
    getCharacters: vi.fn(),
    getCharacter: vi.fn(),
    getRandomCharacters: vi.fn()
  }
}));
const character: RMCharacter = {
  id: 1,
  name: 'Rick',
  status: 'Alive',
  species: 'Human',
  gender: 'Male',
  image: '',
  episode: []
};
afterEach(() => vi.resetAllMocks());
function start() {
  vi.mocked(RickCharacters.getCharacters).mockResolvedValue([character]);
  vi.mocked(RickCharacters.getCharacter).mockResolvedValue(character);
  vi.mocked(RickCharacters.getRandomCharacters).mockResolvedValue([
    { ...character, id: 2, name: 'Morty' }
  ]);
  return createActor(triviaMachine).start();
}
async function enterGame(actor: ReturnType<typeof start>) {
  await waitFor(actor, (s) => s.matches({ homepage: 'dataLoaded' }));
  actor.send({ type: 'user.play' });
  actor.send({ type: 'user.accept' });
  await waitFor(actor, (s) => s.context.hasLoaded && s.context.question === 1);
}
it('scores answers, loses after three mistakes, and resets for another round', async () => {
  const actor = start();
  try {
    await enterGame(actor);
    actor.send({ type: 'user.selectAnswer', answer: 1 });
    expect(actor.getSnapshot().context.points).toBe(10);
    actor.send({ type: 'user.selectAnswer', answer: 1 });
    expect(actor.getSnapshot().context.points).toBe(10);
    for (let question = 2; question <= 4; question++) {
      actor.send({ type: 'user.nextQuestion' });
      await waitFor(
        actor,
        (s) => s.context.hasLoaded && s.context.question === question
      );
      actor.send({ type: 'user.selectAnswer', answer: 2 });
    }
    expect(
      actor
        .getSnapshot()
        .matches({ startTrivia: { questionReady: 'lostGame' } })
    ).toBe(true);
    actor.send({ type: 'user.playAgain' });
    await waitFor(
      actor,
      (s) => s.context.hasLoaded && s.context.question === 1
    );
    expect(actor.getSnapshot().context).toMatchObject({
      points: 0,
      lifes: 3,
      isClueOpened: false
    });
  } finally {
    actor.stop();
  }
});
it('shows a recoverable loading failure instead of stale successful data', async () => {
  const actor = start();
  try {
    await waitFor(actor, (s) => s.matches({ homepage: 'dataLoaded' }));
    vi.mocked(RickCharacters.getCharacter).mockRejectedValueOnce(
      new Error('offline')
    );
    actor.send({ type: 'user.play' });
    actor.send({ type: 'user.accept' });
    await waitFor(actor, (s) => s.matches({ startTrivia: 'questionFailed' }));
    expect(actor.getSnapshot().context.error).toContain('Could not load');
    actor.send({ type: 'user.retry' });
    await waitFor(actor, (s) => s.context.hasLoaded);
    expect(actor.getSnapshot().context.error).toBeNull();
  } finally {
    actor.stop();
  }
});
