import { GameState, Player, Round, RoundSong, TimeRange, RoundCount, ROUND_DURATION } from './types';
import { createGameCode, shuffleArray } from '../utils';
import { getGameFromRedis, setGameInRedis, deleteGameFromRedis, gameExistsInRedis } from './redis-storage';

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

export async function getGame(code: string): Promise<GameState | null> {
  return getGameFromRedis(code);
}

export async function setGame(code: string, game: GameState): Promise<void> {
  await setGameInRedis(code, game);
}

export async function deleteGame(code: string): Promise<void> {
  await deleteGameFromRedis(code);
}

export async function createGame(
  host: Player,
  timeRange: TimeRange = 'medium_term',
  totalRounds: RoundCount = DEFAULT_TOTAL_ROUNDS
): Promise<GameState> {
  let code = createGameCode();
  // Ensure unique code
  while (await gameExistsInRedis(code)) {
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
    heartTotals: {},
    songPool: [],
    createdAt: Date.now(),
    timeRange,
  };

  await setGameInRedis(code, gameState);
  return gameState;
}

export async function addPlayerToGame(code: string, player: Player): Promise<GameState | null> {
  const game = await getGameFromRedis(code);
  if (!game || game.status !== 'lobby') {
    return null;
  }

  // Check if player already exists
  const existingPlayer = game.players.find((p) => p.spotifyId === player.spotifyId);
  if (existingPlayer) {
    existingPlayer.isConnected = true;
    existingPlayer.isReady = player.isReady;
    existingPlayer.topTracks = player.topTracks;
    existingPlayer.selectedPlaylists = player.selectedPlaylists;
    await setGameInRedis(code, game);
    return game;
  }

  game.players.push(player);
  game.scores[player.id] = 0;
  game.heartTotals[player.id] = 0;
  await setGameInRedis(code, game);
  return game;
}

export async function removePlayerFromGame(code: string, playerId: string): Promise<GameState | null> {
  const game = await getGameFromRedis(code);
  if (!game) {
    return null;
  }

  const playerIndex = game.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return game;
  }

  // Mark as disconnected instead of removing
  game.players[playerIndex].isConnected = false;
  await setGameInRedis(code, game);
  return game;
}

/**
 * Spread songs to prevent more than maxConsecutive songs from the same owner in a row
 * Scans through the array and swaps songs when a violation is found
 */
function spreadSongsByOwner(songs: RoundSong[], maxConsecutive: number = 2): RoundSong[] {
  if (songs.length <= maxConsecutive) return songs;

  for (let i = maxConsecutive; i < songs.length; i++) {
    // Check if current position creates a streak > maxConsecutive
    let sameOwnerCount = 1;
    for (let j = 1; j <= maxConsecutive; j++) {
      if (songs[i - j].ownerId === songs[i].ownerId) {
        sameOwnerCount++;
      } else {
        break;
      }
    }

    // If we have too many consecutive songs from same owner, find a swap
    if (sameOwnerCount > maxConsecutive) {
      // Find a song later in the array with a different owner to swap with
      for (let k = i + 1; k < songs.length; k++) {
        if (songs[k].ownerId !== songs[i].ownerId) {
          // Swap the songs
          [songs[i], songs[k]] = [songs[k], songs[i]];
          break;
        }
      }
    }
  }

  return songs;
}

/**
 * Builds the song pool from all players' top tracks with EVEN distribution
 * - Each player contributes roughly equal number of songs
 * - Handles duplicates by assigning to player with higher rank
 * - Shuffles the result for random order
 * - Spreads songs to prevent more than 2 consecutive from same owner
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

  // Shuffle then spread to prevent consecutive same-owner songs
  const shuffledPool = shuffleArray(balancedPool);
  return spreadSongsByOwner(shuffledPool, 2);
}

export async function startGame(code: string): Promise<GameState | null> {
  const game = await getGameFromRedis(code);
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

  // Initialize heartTotals for all players
  game.players.forEach((player) => {
    game.heartTotals[player.id] = 0;
  });

  // Initialize first round
  const firstRound: Round = {
    number: 1,
    song: songPool[0],
    guesses: {},
    guessTimestamps: {},
    hearts: [],
    status: 'waiting',
  };
  game.rounds.push(firstRound);

  await setGameInRedis(code, game);
  return game;
}

export async function startRound(code: string): Promise<Round | null> {
  const game = await getGameFromRedis(code);
  if (!game || game.status !== 'playing') {
    return null;
  }

  const currentRound = game.rounds[game.currentRound];
  if (!currentRound) {
    return null;
  }

  currentRound.status = 'playing';
  currentRound.startedAt = Date.now();
  await setGameInRedis(code, game);
  return currentRound;
}

export async function submitGuess(
  code: string,
  playerId: string,
  guessedPlayerId: string
): Promise<{ round: Round; allGuessed: boolean } | null> {
  const game = await getGameFromRedis(code);
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

  await setGameInRedis(code, game);
  return { round: currentRound, allGuessed };
}

export async function endRound(code: string): Promise<{ round: Round; scores: Record<string, number>; roundScores: Record<string, number>; heartTotals: Record<string, number> } | null> {
  const game = await getGameFromRedis(code);
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

  await setGameInRedis(code, game);
  return { round: currentRound, scores: { ...game.scores }, roundScores, heartTotals: { ...game.heartTotals } };
}

export async function nextRound(code: string): Promise<Round | null> {
  const game = await getGameFromRedis(code);
  if (!game || game.status !== 'playing') {
    return null;
  }

  game.currentRound++;

  if (game.currentRound >= game.totalRounds) {
    game.status = 'finished';
    await setGameInRedis(code, game);
    return null;
  }

  const nextSong = game.songPool[game.currentRound];
  const newRound: Round = {
    number: game.currentRound + 1,
    song: nextSong,
    guesses: {},
    guessTimestamps: {},
    hearts: [],
    status: 'waiting',
  };
  game.rounds.push(newRound);

  await setGameInRedis(code, game);
  return newRound;
}

export async function submitHeart(
  code: string,
  playerId: string
): Promise<{ success: boolean; visibleHeartCount: number; isOwnSong?: boolean; error?: string }> {
  const game = await getGameFromRedis(code);
  if (!game || game.status !== 'playing') {
    return { success: false, visibleHeartCount: 0, error: 'Game not found or not playing' };
  }

  const currentRound = game.rounds[game.currentRound];
  if (!currentRound || currentRound.status !== 'playing') {
    return { success: false, visibleHeartCount: 0, error: 'Round not active' };
  }

  // Check if player is in the game
  const player = game.players.find((p) => p.id === playerId);
  if (!player) {
    return { success: false, visibleHeartCount: 0, error: 'Player not in game' };
  }

  // Check if player has already hearted this round
  if (currentRound.hearts.includes(playerId)) {
    return { success: false, visibleHeartCount: currentRound.hearts.length, error: 'Already hearted this round' };
  }

  // Check if player is trying to heart their own song
  // Allow the action to succeed (for UI purposes) but don't count it
  const songOwnerId = currentRound.song.ownerId;
  if (playerId === songOwnerId) {
    return { success: true, visibleHeartCount: currentRound.hearts.length, isOwnSong: true };
  }

  // Add the heart
  currentRound.hearts.push(playerId);

  // Increment heart total for the song owner
  game.heartTotals[songOwnerId] = (game.heartTotals[songOwnerId] || 0) + 1;

  await setGameInRedis(code, game);
  return { success: true, visibleHeartCount: currentRound.hearts.length };
}

export async function getGameResults(code: string): Promise<{
  scores: Record<string, number>;
  heartTotals: Record<string, number>;
  players: Player[];
} | null> {
  const game = await getGameFromRedis(code);
  if (!game) {
    return null;
  }

  return {
    scores: game.scores,
    heartTotals: game.heartTotals,
    players: game.players,
  };
}
