// Game event names - shared between client and server
export const GAME_EVENTS = {
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  GAME_STARTED: 'game-started',
  ROUND_START: 'round-start',
  PLAYER_GUESSED: 'player-guessed',
  PLAYER_HEARTED: 'player-hearted',
  ROUND_END: 'round-end',
  TIMER_EXPIRED: 'timer-expired',
  GAME_OVER: 'game-over',
  GAME_STATE_SYNC: 'game-state-sync',
} as const;

export type GameEventName = typeof GAME_EVENTS[keyof typeof GAME_EVENTS];
