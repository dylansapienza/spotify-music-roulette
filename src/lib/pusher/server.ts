import Pusher from 'pusher';

// Re-export GAME_EVENTS for convenience
export { GAME_EVENTS } from '@/lib/constants';

// Server-side Pusher instance
let pusherInstance: Pusher | null = null;

export function getPusher(): Pusher {
  if (!pusherInstance) {
    pusherInstance = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return pusherInstance;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function triggerGameEvent(
  gameCode: string,
  event: string,
  data: unknown
): Promise<Pusher.Response> {
  const pusher = getPusher();
  const channel = `presence-game-${gameCode}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await pusher.trigger(channel, event, data);
    } catch (err) {
      lastError = err as Error;
      const isRetryable =
        err instanceof Error &&
        ('code' in err && (err as { code?: string }).code === 'ECONNRESET');

      if (isRetryable && attempt < MAX_RETRIES) {
        console.warn(`Pusher trigger failed (attempt ${attempt}/${MAX_RETRIES}), retrying...`, err);
        await sleep(RETRY_DELAY_MS * attempt);
      } else {
        break;
      }
    }
  }

  console.error(`Pusher trigger failed after ${MAX_RETRIES} attempts:`, lastError);
  throw lastError;
}
