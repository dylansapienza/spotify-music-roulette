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

export function triggerGameEvent(
  gameCode: string,
  event: string,
  data: unknown
): Promise<Pusher.Response> {
  const pusher = getPusher();
  return pusher.trigger(`presence-game-${gameCode}`, event, data);
}
