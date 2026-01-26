import { NextRequest, NextResponse } from 'next/server';
import { startGame, getGame, startRound, buildSongPool } from '@/lib/game/engine';
import { StartGameRequest } from '@/lib/game/types';
import { triggerGameEvent, GAME_EVENTS } from '@/lib/pusher/server';

export async function POST(request: NextRequest) {
  try {
    const body: StartGameRequest = await request.json();
    const { code, hostId } = body;

    if (!code || !hostId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const game = getGame(code.toUpperCase());
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.hostId !== hostId) {
      return NextResponse.json(
        { error: 'Only the host can start the game' },
        { status: 403 }
      );
    }

    if (game.players.filter((p) => p.isConnected).length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 players to start' },
        { status: 400 }
      );
    }

    // Debug: Check track counts before starting
    const totalTracks = game.players.reduce((sum, p) => sum + p.topTracks.length, 0);
    const tracksWithDeezerPreviews = game.players.reduce(
      (sum, p) => sum + p.topTracks.filter((t) => t.deezerPreviewUrl).length,
      0
    );
    console.log(`Game ${code}: Total tracks: ${totalTracks}, With Deezer previews: ${tracksWithDeezerPreviews}`);

    // Start the game
    const gameState = startGame(code.toUpperCase());
    if (!gameState) {
      // Provide more helpful error message
      const errorMsg = tracksWithDeezerPreviews === 0
        ? `No songs with audio previews found. Could not find Deezer previews for any of the ${totalTracks} tracks.`
        : 'Failed to start game - no playable songs available';
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      );
    }

    // Notify all players that the game has started (strip large data to stay under Pusher 10KB limit)
    await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.GAME_STARTED, {
      gameState: {
        code: gameState.code,
        hostId: gameState.hostId,
        status: gameState.status,
        currentRound: gameState.currentRound,
        totalRounds: gameState.totalRounds,
        scores: gameState.scores,
        songPool: [], // Don't send song pool
        rounds: [], // Don't send rounds
        createdAt: gameState.createdAt,
        // Strip tracks from players
        players: gameState.players.map((p) => ({
          id: p.id,
          name: p.name,
          image: p.image,
          spotifyId: p.spotifyId,
          isHost: p.isHost,
          isConnected: p.isConnected,
          topTracks: [], // Strip tracks!
        })),
      },
    });

    // Start the first round after a short delay
    const round = startRound(code.toUpperCase());
    if (round) {
      // Send round start event with minimal song info (strip to essentials)
      await triggerGameEvent(code.toUpperCase(), GAME_EVENTS.ROUND_START, {
        round: {
          number: round.number,
          status: round.status,
          guesses: {},
          guessTimestamps: {},
          startedAt: round.startedAt,
          song: {
            track: {
              id: round.song.track.id,
              name: round.song.track.name,
              artists: round.song.track.artists.map((a) => ({ name: a.name })),
              album: {
                name: round.song.track.album.name,
                images: round.song.track.album.images.slice(0, 1), // Just first image
              },
              deezerPreviewUrl: round.song.track.deezerPreviewUrl, // Deezer preview URL
            },
            // Don't reveal the owner yet!
            ownerId: null,
            ownerName: null,
          },
        },
      });
    }

    return NextResponse.json({ success: true, gameState });
  } catch (error) {
    console.error('Start game error:', error);
    return NextResponse.json(
      { error: 'Failed to start game' },
      { status: 500 }
    );
  }
}
