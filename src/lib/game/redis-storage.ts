import { Redis } from '@upstash/redis';
import { GameState } from './types';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const GAME_PREFIX = 'game:';
const GAME_TTL = 60 * 60 * 4; // 4 hours

export async function getGameFromRedis(code: string): Promise<GameState | null> {
  return redis.get<GameState>(`${GAME_PREFIX}${code.toUpperCase()}`);
}

export async function setGameInRedis(code: string, game: GameState): Promise<void> {
  await redis.set(`${GAME_PREFIX}${code.toUpperCase()}`, game, { ex: GAME_TTL });
}

export async function deleteGameFromRedis(code: string): Promise<void> {
  await redis.del(`${GAME_PREFIX}${code.toUpperCase()}`);
}

export async function gameExistsInRedis(code: string): Promise<boolean> {
  const exists = await redis.exists(`${GAME_PREFIX}${code.toUpperCase()}`);
  return exists === 1;
}
