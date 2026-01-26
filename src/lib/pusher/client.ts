'use client';

import PusherClient from 'pusher-js';
import type { Channel, PresenceChannel } from 'pusher-js';

let pusherClient: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (!pusherClient) {
    pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
    });
  }
  return pusherClient;
}

export function subscribeToGame(
  gameCode: string,
  userId: string,
  userName: string
): PresenceChannel {
  // Create a new client for each subscription with auth params
  const client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: '/api/pusher/auth',
    auth: {
      params: {
        user_id: userId,
        user_name: userName,
      },
    },
  });

  // Store reference
  pusherClient = client;

  return client.subscribe(`presence-game-${gameCode}`) as PresenceChannel;
}

export function unsubscribeFromGame(gameCode: string): void {
  if (pusherClient) {
    pusherClient.unsubscribe(`presence-game-${gameCode}`);
  }
}

export function getChannel(gameCode: string): Channel | undefined {
  if (!pusherClient) return undefined;
  return pusherClient.channel(`presence-game-${gameCode}`);
}
