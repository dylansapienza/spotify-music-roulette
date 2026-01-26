import { GameState, Player, Round, RoundSong, SpotifyTrack, TimeRange, RoundCount, ROUND_DURATION } from './types';
import { createGameCode, shuffleArray } from '../utils';

const DEFAULT_TOTAL_ROUNDS: RoundCount = 10;
const BASE_POINTS = 100;
const POINTS_PER_SECOND_PENALTY = 2;
const MIN_POINTS = BASE_POINTS - (ROUND_DURATION * POINTS_PER_SECOND_PENALTY); // 40 points at 30 seconds

/**
 * Calculate points based on time taken to guess correctly
 * - 100 points at 0 seconds
 * - Subtract 2 points per second
 * - Minimum 40 points at 30 seconds
 */
function calculateTimeBasedScore(roundStartedAt: number, guessTimestamp: number): number {
  const elapsedMs = guessTimestamp - roundStartedAt;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const score = BASE_POINTS - (elapsedSeconds * POINTS_PER_SECOND_PENALTY);
  return Math.max(MIN_POINTS, score);
}

// In-memory game storage (replace with Redis/KV in production)
const games = new Map<string, GameState>();

export function getGame(code: string): GameState | undefined {
  return games.get(code);
}

export function setGame(code: string, game: GameState): void {
  games.set(code, game);
}

export function deleteGame(code: string): void {
  games.delete(code);
}

export function createGame(
  host: Player,
  timeRange: TimeRange = 'medium_term',
  totalRounds: RoundCount = DEFAULT_TOTAL_ROUNDS
): GameState {
  let code = createGameCode();
  // Ensure unique code
  while (games.has(code)) {
    code = createGameCode();
  }

  const gameState: GameState = {
    code,
    hostId: host.id,
    status: 'lobby',
    players: [{ ...host, isHost: true }],
    rounds: [],
    currentRound: 0,
    totalRounds,
    scores: { [host.id]: 0 },
    songPool: [],
    createdAt: Date.now(),
    timeRange,
  };

  games.set(code, gameState);
  return gameState;
}

export function addPlayerToGame(code: string, player: Player): GameState | null {
  const game = games.get(code);
  if (!game || game.status !== 'lobby') {
    return null;
  }

  // Check if player already exists
  const existingPlayer = game.players.find((p) => p.spotifyId === player.spotifyId);
  if (existingPlayer) {
    existingPlayer.isConnected = true;
    existingPlayer.topTracks = player.topTracks;
    return game;
  }

  game.players.push(player);
  game.scores[player.id] = 0;
  return game;
}

export function removePlayerFromGame(code: string, playerId: string): GameState | null {
  const game = games.get(code);
  if (!game) {
    return null;
  }

  const playerIndex = game.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return game;
  }

  // Mark as disconnected instead of removing
  game.players[playerIndex].isConnected = false;
  return game;
}

/**
 * Assigns a song to a single owner based on who has it ranked highest
 */
function assignSongOwner(track: SpotifyTrack, players: Player[]): Player | null {
  const playersWithSong = players.filter((p) =>
    p.topTracks.some((t) => t.id === track.id)
  );

  if (playersWithSong.length === 0) {
    return null;
  }

  if (playersWithSong.length === 1) {
    return playersWithSong[0];
  }

  // Multiple players - assign to whoever has it ranked higher (lower index = higher rank)
  return playersWithSong.reduce((best, player) => {
    const playerRank = player.topTracks.findIndex((t) => t.id === track.id);
    const bestRank = best.topTracks.findIndex((t) => t.id === track.id);
    return playerRank < bestRank ? player : best;
  });
}

/**
 * Builds the song pool from all players' top tracks with EVEN distribution
 * - Each player contributes roughly equal number of songs
 * - Handles duplicates by assigning to player with higher rank
 * - Shuffles the result for random order
 */
export function buildSongPool(players: Player[], totalRounds: number = DEFAULT_TOTAL_ROUNDS): RoundSong[] {
  const numPlayers = players.length;
  if (numPlayers === 0) return [];

  // Step 1: Build a map of all songs with their assigned owner
  const songsByOwner = new Map<string, RoundSong[]>(); // playerId -> songs
  const usedTrackIds = new Set<string>();

  // Initialize empty arrays for each player
  players.forEach((p) => songsByOwner.set(p.id, []));

  // Go through each player's tracks and assign ownership
  // Process by rank (index) to handle duplicates - higher ranked (lower index) wins
  const maxTracks = Math.max(...players.map((p) => p.topTracks.length));
  
  for (let rank = 0; rank < maxTracks; rank++) {
    for (const player of players) {
      const track = player.topTracks[rank];
      if (!track) continue;
      
      // Skip if this track was already assigned to someone with higher rank
      if (usedTrackIds.has(track.id)) continue;
      
      usedTrackIds.add(track.id);
      songsByOwner.get(player.id)!.push({
        track,
        ownerId: player.id,
        ownerName: player.name,
      });
    }
  }

  // Step 2: Calculate how many songs each player should contribute
  const baseSongsPerPlayer = Math.floor(totalRounds / numPlayers);
  let remainder = totalRounds % numPlayers;

  // Step 3: Build the balanced pool
  const balancedPool: RoundSong[] = [];
  const playerContributions: Record<string, number> = {};

  // Shuffle each player's available songs for variety
  players.forEach((player) => {
    const playerSongs = songsByOwner.get(player.id) || [];
    songsByOwner.set(player.id, shuffleArray([...playerSongs]));
  });

  // First pass: give each player their base amount
  for (const player of players) {
    const playerSongs = songsByOwner.get(player.id) || [];
    const targetCount = baseSongsPerPlayer + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    
    const songsToTake = Math.min(targetCount, playerSongs.length);
    balancedPool.push(...playerSongs.slice(0, songsToTake));
    playerContributions[player.id] = songsToTake;
    
    // Remove taken songs from available pool
    songsByOwner.set(player.id, playerSongs.slice(songsToTake));
  }

  // Second pass: if we don't have enough songs, fill from players with extras
  while (balancedPool.length < totalRounds) {
    let addedAny = false;
    
    for (const player of players) {
      if (balancedPool.length >= totalRounds) break;
      
      const remainingSongs = songsByOwner.get(player.id) || [];
      if (remainingSongs.length > 0) {
        balancedPool.push(remainingSongs[0]);
        songsByOwner.set(player.id, remainingSongs.slice(1));
        playerContributions[player.id]++;
        addedAny = true;
      }
    }
    
    // If no player has any songs left, stop
    if (!addedAny) break;
  }

  // Log the distribution
  const distribution = players.map((p) => `${p.name.split(' ')[0]}: ${playerContributions[p.id] || 0}`).join(', ');
  console.log(`Song pool: ${balancedPool.length} songs (${distribution})`);

  return shuffleArray(balancedPool);
}

export function startGame(code: string): GameState | null {
  const game = games.get(code);
  if (!game || game.status !== 'lobby') {
    return null;
  }

  // Build the song pool with even distribution across players
  const requestedRounds = game.totalRounds;
  const songPool = buildSongPool(game.players, requestedRounds);
  
  // Limit rounds to available songs (in case players don't have enough)
  const totalRounds = Math.min(requestedRounds, songPool.length);
  
  if (totalRounds === 0) {
    return null; // No playable songs
  }

  game.songPool = songPool;
  game.totalRounds = totalRounds;
  game.status = 'playing';
  game.currentRound = 0;

  // Initialize first round
  const firstRound: Round = {
    number: 1,
    song: songPool[0],
    guesses: {},
    guessTimestamps: {},
    status: 'waiting',
  };
  game.rounds.push(firstRound);

  return game;
}

export function startRound(code: string): Round | null {
  const game = games.get(code);
  if (!game || game.status !== 'playing') {
    return null;
  }

  const currentRound = game.rounds[game.currentRound];
  if (!currentRound) {
    return null;
  }

  currentRound.status = 'playing';
  currentRound.startedAt = Date.now();
  return currentRound;
}

export function submitGuess(
  code: string,
  playerId: string,
  guessedPlayerId: string
): { round: Round; allGuessed: boolean } | null {
  const game = games.get(code);
  if (!game || game.status !== 'playing') {
    return null;
  }

  const currentRound = game.rounds[game.currentRound];
  if (!currentRound || currentRound.status !== 'playing') {
    return null;
  }

  // Record the guess and timestamp
  currentRound.guesses[playerId] = guessedPlayerId;
  currentRound.guessTimestamps[playerId] = Date.now();

  // Check if all connected players have guessed
  const connectedPlayers = game.players.filter((p) => p.isConnected);
  const allGuessed = connectedPlayers.every((p) => currentRound.guesses[p.id]);

  return { round: currentRound, allGuessed };
}

export function endRound(code: string): { round: Round; scores: Record<string, number>; roundScores: Record<string, number> } | null {
  const game = games.get(code);
  if (!game || game.status !== 'playing') {
    return null;
  }

  const currentRound = game.rounds[game.currentRound];
  if (!currentRound) {
    return null;
  }

  currentRound.status = 'revealing';

  // Calculate time-based scores for this round
  const correctOwnerId = currentRound.song.ownerId;
  const roundStartedAt = currentRound.startedAt || Date.now();
  const roundScores: Record<string, number> = {};

  Object.entries(currentRound.guesses).forEach(([playerId, guessedId]) => {
    if (guessedId === correctOwnerId) {
      // Correct guess - calculate time-based score
      const guessTimestamp = currentRound.guessTimestamps[playerId] || Date.now();
      const points = calculateTimeBasedScore(roundStartedAt, guessTimestamp);
      roundScores[playerId] = points;
      game.scores[playerId] = (game.scores[playerId] || 0) + points;
    } else {
      // Wrong guess - 0 points
      roundScores[playerId] = 0;
    }
  });

  // Players who didn't guess also get 0 points
  game.players.forEach((player) => {
    if (!(player.id in roundScores)) {
      roundScores[player.id] = 0;
    }
  });

  currentRound.status = 'complete';

  return { round: currentRound, scores: { ...game.scores }, roundScores };
}

export function nextRound(code: string): Round | null {
  const game = games.get(code);
  if (!game || game.status !== 'playing') {
    return null;
  }

  game.currentRound++;

  if (game.currentRound >= game.totalRounds) {
    game.status = 'finished';
    return null;
  }

  const nextSong = game.songPool[game.currentRound];
  const newRound: Round = {
    number: game.currentRound + 1,
    song: nextSong,
    guesses: {},
    guessTimestamps: {},
    status: 'waiting',
  };
  game.rounds.push(newRound);

  return newRound;
}

export function getGameResults(code: string): {
  scores: Record<string, number>;
  players: Player[];
} | null {
  const game = games.get(code);
  if (!game) {
    return null;
  }

  return {
    scores: game.scores,
    players: game.players,
  };
}
