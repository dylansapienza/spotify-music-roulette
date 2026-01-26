// Spotify types
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
  external_ids?: {
    isrc?: string;
  };
  deezerPreviewUrl?: string | null; // Deezer 30-second preview URL
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
}

// User search result from public API (doesn't include email)
export interface SpotifyUserSearchResult {
  id: string;
  display_name: string;
  images: { url: string; width?: number; height?: number }[];
  external_urls: {
    spotify: string;
  };
  followers?: {
    total: number;
  };
}

// Playlist types for public API
export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: { url: string; width?: number; height?: number }[];
  owner: {
    id: string;
    display_name: string;
  };
  tracks: {
    total: number;
  };
  public: boolean | null;
  external_urls: {
    spotify: string;
  };
}

// Player's selected playlists
export interface PlaylistSelection {
  id: string;
  name: string;
  imageUrl?: string;
  trackCount: number;
}

// Player profile for the new flow (without OAuth)
export interface PlayerProfile {
  spotifyId: string;
  displayName: string;
  imageUrl?: string;
  selectedPlaylists: PlaylistSelection[];
}

// Time range options for Spotify top tracks
export type TimeRange = 'short_term' | 'medium_term' | 'long_term';

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  short_term: 'Last 4 Weeks',
  medium_term: 'Last 6 Months',
  long_term: 'All Time',
};

// Game constants
export const ROUND_DURATION = 30; // seconds per round

// Game types
export interface Player {
  id: string;
  name: string;
  image: string | null;
  spotifyId: string;
  topTracks: SpotifyTrack[]; // Now contains tracks from selected playlists
  selectedPlaylists: PlaylistSelection[]; // Playlists the player selected
  isHost: boolean;
  isConnected: boolean;
  isReady: boolean; // Whether player has finished selecting playlists
}

export interface RoundSong {
  track: SpotifyTrack;
  ownerId: string; // Player ID who "owns" this song
  ownerName: string;
}

export interface Round {
  number: number;
  song: RoundSong;
  guesses: Record<string, string>; // playerId -> guessedPlayerId
  guessTimestamps: Record<string, number>; // playerId -> timestamp when they guessed
  hearts: string[]; // Array of playerIds who hearted this round's song
  status: 'waiting' | 'playing' | 'revealing' | 'complete';
  startedAt?: number;
}

export interface GameState {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'finished';
  players: Player[];
  rounds: Round[];
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>; // playerId -> score
  heartTotals: Record<string, number>; // ownerId -> total hearts received on their songs
  songPool: RoundSong[];
  createdAt: number;
  timeRange: TimeRange;
}

// Events for Pusher
export type GameEvent =
  | { type: 'player-joined'; player: Player }
  | { type: 'player-left'; playerId: string }
  | { type: 'player-ready'; playerId: string; selectedPlaylists: PlaylistSelection[] }
  | { type: 'game-started'; gameState: GameState }
  | { type: 'round-start'; round: Round }
  | { type: 'player-guessed'; playerId: string; hasGuessed: boolean }
  | { type: 'player-hearted'; playerId: string; visibleHeartCount: number }
  | { type: 'round-end'; round: Round; scores: Record<string, number>; roundScores: Record<string, number>; heartTotals: Record<string, number> }
  | { type: 'timer-expired' }
  | { type: 'game-over'; finalScores: Record<string, number>; heartTotals: Record<string, number> }
  | { type: 'game-state-sync'; gameState: GameState };

// API request/response types
// Available round counts
export const ROUND_OPTIONS = [10, 25, 35, 50] as const;
export type RoundCount = typeof ROUND_OPTIONS[number];

export interface CreateGameRequest {
  hostName: string;
  hostSpotifyId: string;
  hostImage: string | null;
  selectedPlaylists: PlaylistSelection[];
  totalRounds?: RoundCount;
}

export interface CreateGameResponse {
  code: string;
  gameState: GameState;
}

export interface JoinGameRequest {
  code: string;
  playerName: string;
  playerSpotifyId: string;
  playerImage: string | null;
  selectedPlaylists: PlaylistSelection[];
}

export interface JoinGameResponse {
  success: boolean;
  gameState?: GameState;
  error?: string;
}

export interface StartGameRequest {
  code: string;
  hostId: string;
}

export interface GuessRequest {
  code: string;
  playerId: string;
  guessedPlayerId: string;
}

export interface HeartRequest {
  code: string;
  playerId: string;
}
